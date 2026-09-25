# Éligibilité aux examens, sessions et barème reproductible

Références : issues **#256** (éligibilité / sessions) et **#257** (barème reproductible),
spécification M9 `docs/superpowers/specs/2026-09-25-m9-finalization-design.md` (lot B).

Ce document décrit le comportement **contractuel** du flux examen côté candidat.
Toute évolution doit keeps ces invariants, couverts par des tests.

---

## 1. Inscription (`ExamEnrollment`)

L'absence de ligne d'inscription ne vaut **jamais** éligibilité pour un examen
`OFFICIAL`. La ligne est créée par une action explicite d'un administrateur
(affectation d'un examen à un compte) — jamais par un backfill de migration.

### Champs de suivi (ajoutés de façon additive)

| Champ | Type | Rôle |
|-------|------|------|
| `status` | `TEXT` (`ACTIVE` \| `REVOKED`) | ouvertures effective de l'accès |
| `source` | `TEXT` | origine de l'inscription (`ADMIN_ASSIGNMENT`, `IMPORT`, `API`, …) |
| `grantedById` | `TEXT` | compte ayant accordé l'inscription |
| `note` | `TEXT` | commentaire administratif |
| `revokedAt` / `revokedById` / `revokeReason` | `TEXT`/`TIMESTAMP` | révocation logique |
| `updatedAt` | `TIMESTAMP` | dernière modification |

Points de conception :

- **`status` est un `TEXT`, pas un enum Prisma** : les lignes historiques restent
  compatibles et une valeur inconnue est **refusée** (`EXAM_ENROLLMENT_INVALID`)
  au lieu d'être traitée comme active.
- Migration `prisma/migrations/20260925_exam_enrollment_tracking` : uniquement des
  `ADD COLUMN IF NOT EXISTS` + index. Aucun `DROP`, aucun `UPDATE`, aucun
  `CREATE TYPE`. Le défaut `'ACTIVE'` **reproduit exactement** l'éligibilité
  d'avant le lot (une inscription présente = inscription active), donc aucun
  backfill n'est nécessaire.
- La révocation est **logique** : aucune ligne n'est supprimée, l'historique
  d'attribution reste lisible.

### Idempotence

`lib/exams/enrollment.ts` est le point d'entrée unique :

- `grantExamEnrollment()` — `upsert` sur la clé unique `(userId, examId)` :
  rejouer la même affectation ne duplique rien ; une inscription `REVOKED` est
  réactivée (les champs de révocation sont effacés).
- `revokeExamEnrollment()` — `updateMany` conditionné à `status = 'ACTIVE'` :
  révoquer deux fois ne réécrit pas la date de révocation et ne lève pas.

Garantie vérifiée par `tests/lib/exam-enrollment.test.ts` (idempotence,
réactivation, client transactionnel, bornes de saisie).

---

## 2. Matrice d'éligibilité

Contrôlé sur les **quatre** points d'entrée du flux : `GET /api/exams/[id]`,
`POST .../start`, `GET|POST|DELETE .../draft`, `POST .../submit`.

| `Exam.type` | demandeur | inscription | résultat |
|--------------|-----------|-------------|----------|
| `OFFICIAL` | candidat | `ACTIVE` | autorisé |
| `OFFICIAL` | candidat | absente | **403** `EXAM_NOT_ENROLLED` |
| `OFFICIAL` | candidat | `REVOKED` | **403** `EXAM_ENROLLMENT_REVOKED` |
| `OFFICIAL` | candidat | statut inconnu | **403** `EXAM_ENROLLMENT_INVALID` |
| `OFFICIAL` | admin | — | autorisé (contournement **explicite**, `isAdmin: true`) |
| `MOCK` | candidat | — | autorisé, **sans lecture de l'inscription** |

### Comportement MOCK (documenté)

Un examen `MOCK` est un entraînement : il reste ouvert à tous les candidats
connectés, inscription ou non, et la révocation d'une inscription `OFFICIAL`
ne le ferme pas. La conséquence assumée est qu'un `MOCK` ne peut pas servir de
preuve officielle : il ne déclenche aucune attestation
(`app/api/exams/[id]/submit` n'émet une attestation que pour `OFFICIAL`).

### Ordre des contrôles (submit)

L'éligibilité est évaluée **avant** toute lecture de session : un candidat non
inscrit reçoit `403` et la route ne révèle ni l'existence d'une session ni son
statut (pas de `409 « session non démarrée »` qui confirmerait une session).
L'examen n'est lu qu'une fois, le contrôle d'accès et la correction partageant
le même objet.

---

## 3. Rate-limit des points d'entrée sensibles

Ajoutés dans ce lot (ils étaient absents — voir `lib/rate-limit.ts`), avec
équivalent mémoire pour le mode sans Redis :

| Budget | Limite | Points d'entrée |
|--------|--------|-----------------|
| `examRead` | 60 / min | `GET /api/exams/[id]`, `GET /api/user/exams` |
| `examStart` | 20 / h | `POST /api/exams/[id]/start` |
| `examDraft` | 400 / h | `GET|POST|DELETE /api/exams/[id]/draft` |
| `submission` | 5 / h (existant) | `POST /api/exams/[id]/submit` |

- Clé par **IP et par utilisateur** (`applyRateLimitByUser`) : changer d'IP ne
  contourne pas la limite.
- `examDraft` est calibré au-dessus du rythme nominal du client (persistance
  toutes les 15 s, soit ~240 appels sur un examen d'une heure) : la limite ne
  pénalise pas un examen légitime, elle bloque une boucle.
- Le rate-limit passe **avant** tout accès à l'examen : une requête bloquée ne
  consomme aucun quota métier et ne touche pas la base.
- `GET /api/exams/[id]` sans utilisateur connecté (navigation admin) est borné
  par IP via `applyRateLimit`.

---

## 4. Barème reproductible et snapshot versionné

- Fonction de score unique : `lib/exams/scoring.ts`
  (`calculateCanonicalScore`, `computePart1Score`, `isPassed`).
  `totalScore` = somme brute des points, `finalScore` = pourcentage 0..100,
  `passingScore` = pourcentage.
- Le barème est **figé avec la soumission** dans un snapshot versionné
  (`answers._customBareme`, `version: 1`, `maxPart1/2/3`, `totalMax`), relu par
  la correction admin (`readSubmissionScoringSnapshot`). Conséquence : modifier
  le barème d'un examen après coup ne réécrit **aucun** score historique, et la
  correction recalcule sur l'échelle de la soumission, pas sur celle du jour.
- Le stockage est **additif** : le snapshot vit dans le champ JSON `answers`,
  aucune colonne ni migration supplémentaire.

---

## 5. Transitions concurrentes

| Transition | Garde |
|------------|-------|
| création de session | `upsert` sur `@@unique([userId, examId])` — deux `start` simultanéscreating une seule session |
| `IN_PROGRESS`/`PENDING` → soumise | `updateMany` conditionné à `status IN (...) AND submittedAt IS NULL` — la seconde écriture est rejetée (`409`) |
| `PENDING_REVIEW`/`COMPLETED`/`GRADED` → `GRADED` | `updateMany` conditionné au statut observé **et** `submittedAt IS NOT NULL` — une correction concurrente perdante est rejetée (`409`) |
| correction sans soumission | refusée avant tout accès en base (`409`) |

Les gardes vivent dans la **requête** (`where` conditionnel), pas dans une
lecture applicative : deux requêtes HTTP réellement concurrentes ne peuvent pas
toutes deux écrire. Couvrir par `tests/api/exams-submit.test.ts` (double
soumission) et `tests/api/correct-sentinel.test.ts` (correction concurrente).

---

## 6. Tests associés

| Fichier | Objet |
|---------|-------|
| `tests/lib/exam-enrollment.test.ts` | idempotence grant/revoke, réactivation, bornes |
| `tests/lib/exam-enrollment-migration.test.ts` | migration additive / TEXT / non destructive |
| `tests/lib/exam-eligibility.test.ts` | matrice d'éligibilité, MOCK ouvert |
| `tests/api/exams-enrollment-guards.test.ts` | refus 403 sur GET/start/draft/submit, 429, MOCK |
| `tests/api/exams-submit.test.ts` | garde conditionnelle, double soumission, snapshot |
| `tests/api/exams-start.test.ts` | refus sans inscription, `start` concurrent |
