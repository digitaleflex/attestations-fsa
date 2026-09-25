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

## 3. Inventaire FSA de référence — `scripts/check-data-integrity.ts`

**Lecture seule de la base** : aucune méthode Prisma d’écriture n’est utilisée et les codes FSA
ne sont jamais régénérés. Le rapport JSON contient des empreintes SHA-256, jamais les identifiants
internes, noms, emails, lieux de naissance ni URL de documents.

```bash
# Génération initiale sur une copie à jour de la base de référence :
pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/check-data-integrity.ts --dry-run --report reports/fsa-reference.json

# Contrôle ultérieur : le rapport courant est comparé au fichier de référence versionné :
pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/check-data-integrity.ts --read-only \
  --report reports/fsa-current.json --baseline reports/fsa-reference.json
```

Le mode lecture seule est le seul mode : aucune option de correction n’est acceptée. Les contrôles
couvrent le format et l’unicité des codes FSA, les preuves et leur statut, `sessionId`, la cohérence
`pdfUrl`/`pdfKey`, les dates, les liens utilisateurs/formations/sessions, les doublons de session et
les certificats. Le changement ou la suppression d’un code par rapport à la référence est
`CRITICAL`; un nouvel enregistrement est un avertissement afin de permettre les émissions
légitimes ultérieures. Les autres changements métier restent inventoriés sans être figés.

**Code de sortie** : `1` si au moins une anomalie `CRITICAL`, sinon `0`. Le schéma Prisma courant ne
contient pas `pdfKey`; lorsqu’une base legacy possède cette colonne, elle est automatiquement
inventoriée, et l’absence de colonne produit un avertissement de compatibilité.

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

## 6. Objet stocké et propriété (#260)

Le registre `StoredObject` (clé, propriétaire, usage, entité liée, empreinte SHA-256, date de
conservation) s’ajoute aux contrôles du script :

| Contrôle | Sévérité | Signification |
| --- | --- | --- |
| `STORAGE.key.prefix` | CRITICAL | clé hors `cv/`, `stages/`, `attestations/`, `exports/`, `temporary/` |
| `STORAGE.key.signed` | CRITICAL | une URL signée est stockée comme clé |
| `STORAGE.key.duplicate` | CRITICAL | clé enregistrée deux fois |
| `STORAGE.checksum.format` | CRITICAL | empreinte absente ou non SHA-256 |
| `STORAGE.official.link` | CRITICAL | PDF officiel sans entité liée |
| `STORAGE.internship.signed-persisted` | CRITICAL | `cvUrl` de candidature contenant une signature |
| `STORAGE.owner.link` | WARNING | propriétaire absent de la base |
| `STORAGE.internship.key.unregistered` | WARNING | `cvKey` absent du registre |
| `STORAGE.purpose.prefix` | WARNING | préfixe incohérent avec l’usage déclaré |
| `STORAGE.schema` | WARNING | table `StoredObject` absente du modèle courant |

Ces contrôles sont en lecture seule : ni les URLs historiques, ni les 40 attestations, ni les
candidatures existantes ne sont réécrites. Les objets uploadés avant #260 ne sont pas enregistrés
au registre : ils restent non supprimables (404) plutôt que supprimables par clé devinée.
