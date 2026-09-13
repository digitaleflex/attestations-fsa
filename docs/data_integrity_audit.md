# Audit d'intégrité des données & migrations (#146 · A5)

> Rapport de l'audit A5 (EPIC #131). Date : 2026-09-13.
> Script de vérification : `scripts/check-data-integrity.ts` (lecture seule).

## 1. Migrations

**13 migrations** appliquées (ordre chronologique) :

| # | Migration | Objet |
| :-- | :-- | :-- |
| 1–7 | `20250703…` → `20260331…` | Init, Better Auth, corrections, settings, report, système d'examen, profil candidat |
| 8 | `20260910_sync_schema` | Synchronisation schéma |
| 9 | `20260911000000_add_two_factor` | 2FA |
| 10 | `20260911000001_two_factor_userid_unique` | Unicité 2FA |
| 11 | `20260912_attestation_session_link` | Lien attestation ↔ session |
| 12 | `20260912_exam_session_unique` | **Unicité `ExamSession(userId, examId)`** (#121) + dédup |
| 13 | `20260912_score_part_nullable` | **`scorePart2/3` nullable** (#117) |

**Dérive schéma/DB** : non vérifiable localement (DB inaccessible P1000). À contrôler sur le VPS :
`pnpm prisma migrate status`.

## 2. Contraintes

### Unicités (7)
- `Account(providerId, accountId)` · `Session.token` · `User.email` · `User.attestationCode`
- `CandidateProfile.userId` · `Attestation.code` · **`ExamSession(userId, examId)`** (#121)

### Cascades (8)
`onDelete: Cascade` sur : `Account→User`, `Session→User`, `CandidateProfile→User`, `ExamPart→Exam`,
`Question→ExamPart`, `Option→Question`, `CompositionScan→ExamSession`, `Notification→User`.

### FKs à suppression **restreinte** (protection volontaire)
- `Attestation.formation` (requis, pas de `onDelete`) → **Restrict** : impossible de supprimer une
  formation qui a des attestations (pas d'orphelin).
- `Attestation.user` (optionnel, pas de `onDelete`) → **SetNull** : la suppression d'un utilisateur
  **conserve le certificat** (choix produit : valeur probante).

## 3. Script de vérification — `scripts/check-data-integrity.ts`

**Lecture seule**, jamais d'écriture. 5 familles de contrôles :

| Contrôle | Sévérité | Détail |
| :-- | :-- | :-- |
| **FK orphelines** | CRITICAL | `ExamSession.examId/userId`, `Attestation.formationId` pointant vers des entités inexistantes |
| **Doublons** | CRITICAL | `ExamSession(userId, examId)` dupliqués (contrat #121) |
| **Scores** | CRITICAL/WARNING | `finalScore` hors 0..100, `totalScore` négatif ou > max, parts > barème, `totalScore ≠ somme des parts` |
| **Attestations** | WARNING | Format du code (`FSA-YYYY-MXX-NNNNN-hash`), `REJECTED` avec score |
| **Statuts de session** | CRITICAL/WARNING | `GRADED` avec `scorePart2` null (sentinelle #117 contournée), `IN_PROGRESS` avec score |

```bash
# Sur le VPS (ou en local avec DATABASE_URL) :
pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/check-data-integrity.ts
```

**Code de sortie** : `1` si au moins une anomalie **CRITICAL** → utilisable en CI / cron.

## 4. Résultats de l'audit

- **Schéma** : aucune contrainte manquante sur les clés métier ; les cascades sont cohérentes
  (données dépendantes supprimées, données probantes préservées).
- **Seed / reproductibilité** : `prisma/seed.ts` + scripts `create-admin.ts`, `create-demo-candidat.ts` présents.
- **Backup/restauration** : `db-dump.ts`, `docker-local-restore.sh` présents (cf. #19).
- **Anomalies en base** : à mesurer sur le VPS via le script ci-dessus (DB locale inaccessible ici).

## 5. Recommandations

1. **Exécuter `check-data-integrity.ts`** sur le VPS après `prisma migrate deploy` (valider que la
   dédup #121 a bien laissé 0 doublon).
2. **Automatiser** : job CI/cron mensuel exécutant le script (échec CRITICAL → alerte).
3. **Migrations futures** : toute fusion de canaux (`feedback 4→2`, #75) doit être accompagnée d'une
   migration de données réversible + vérification d'intégrité référentielle **avant** drop
   (cf. `SecurityLog`, `Report`, `CompositionScan`).
4. **Étendre le script** au besoin avec `Report`/`Contact` orphelins si ces modèles évoluent.
