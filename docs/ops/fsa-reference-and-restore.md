# Gel des codes FSA, export de référence, sauvegarde et restauration (#255 / #259)

Date : 2026-09-25 — Branche : `m9/final-255-259`

Ce document décrit la procédure **opérationnelle** du lot A. Elle est
entièrement **locale et testable** : aucun des scripts ci-dessous n'écrit dans la
base, aucun n'est exécuté contre la production, aucun ne modifie un code `FSA-*`.

## 1. Invariants

- `Attestation.code` est **immuable** : ni modification, ni renumérotage, ni
  suppression (la route admin d'attestation est auditée, la suppression d'un
  certificat émis reste interdite par la décision métier).
- Une attestation existante n'est jamais supprimée ni dupliquée.
- Aucune URL signée n'est écrite en base.
- Les opérations de migration/inventaire sont **read-only** par défaut
  (transaction PostgreSQL `READ ONLY`).
- Aucun rapport ni artefact versionné ne contient de PII ni de secret.

## 2. Export de référence versionné et sûr (#255)

```bash
pnpm exec ts-node --project tsconfig.seed.json scripts/export-reference.ts \
  --out reports/fsa-reference-export.json \
  --digest-out reports/fsa-reference-digest.json

# empreinte seule (à relever AVANT une sauvegarde, à rejouer APRÈS restauration)
pnpm exec ts-node --project tsconfig.seed.json scripts/export-reference.ts --print-digest
```

Contenu : attestations, sessions, utilisateurs, formations et **relations**.

- **Aucune PII** : ni nom, ni prénom, ni email, ni date/lieu de naissance, ni
  adresse, ni téléphone. Chaque entité est désignée par une empreinte SHA-256
  tronquée (`attestation#…`, `user#…`).
- **Aucun secret** : ni jeton, ni URL signée (`X-Amz-`, `Signature=`, `token=`),
  ni clé d'objet R2, ni valeur de sceau, ni chemin d'hôte.
- **Aucun code en clair** : l'export conserve l'empreinte du code, son année, son
  mois et sa séquence — de quoi prouver l'inventaire et le gel sans diffuser un
  code imprimable.
- **Reproductible** : même base ⇒ même empreinte (`digest`), indépendamment de
  l'ordre de lecture des lignes et de la date d'exécution (`generatedAt` est la
  seule donnée variable, exclue de l'empreinte).
- **Lecture seule** : le snapshot est chargé dans une transaction
  `READ ONLY` ; `--apply` est refusé ; le module et le script ne référencent
  aucune API d'écriture Prisma.

Avant publication comme artefact versionné, l'export passe
`assertReferenceExportIsSafe()` : toute clé interdite (`code`, `fullName`,
`email`, `pdfKey`…) ou toute valeur sensible (email, code FSA, URL signée,
chemin `/home/…`, secret) fait échouer l'écriture.

## 3. Manifeste de sauvegarde (#255)

```bash
# après scripts/vps-pre-deploy-backup.sh ou tout pg_dump -Fc local
pnpm exec ts-node --project tsconfig.seed.json scripts/backup-manifest.ts \
  --dir /home/audest/backups/attestation-fsa/20260925-030000 \
  --out reports/backup-manifest.json
```

Le manifeste est **versionné** (`schemaVersion`), trié, et porte pour chaque
artefactil : le **nom seul**, la **taille en octets**, l'**empreinte SHA-256**,
plus la **couverture** (base oui/non, volumes couverts) et la **date**. Il
n'écrit aucun chemin absolu, aucune URL, aucun secret. Les sidecars
`.sha256`/`.age` sont ignorés. Un répertoire vide ou un chemin absent est une
erreur explicite, jamais un manifeste vide.

Sortie non nulle si la sauvegarde ne couvre pas la base.

## 4. Procédure de restauration testable localement

Le script **ne restaure rien** : il vérifie, puis produit un plan.

```bash
pnpm exec ts-node --project tsconfig.seed.json scripts/verify-backup-restore.ts \
  --manifest reports/backup-manifest.json \
  --dir /home/audest/backups/attestation-fsa/20260925-030000 \
  --host localhost --database fsa_restore_20260925 \
  --plan reports/restore-plan.json
```

Refus (code de sortie 2, aucun fichier écrit) si :

- l'hôte n'est pas local (`localhost`, `127.0.0.1`, `::1`, service Docker de
  test) ;
- la base ne s'appelle pas `fsa_restore_*` ;
- une seule anomalie critique de sauvegarde subsiste (empreinte, taille, absence
  d'un artefact, absence de dump).

Sinon le plan contient les commandes **à exécuter à la main** :
`createdb` sur la base isolée, `pg_restore --clean --if-exists --no-owner`, puis
les contrôles post-restauration :

1. `sha256sum` du dump = valeur du manifeste ;
2. contrôle d'intégrité applicative read-only
   (`scripts/check-data-integrity.ts --dry-run`) ;
3. export de référence : **empreinte identique** à celle relevée avant la
   sauvegarde — c'est la preuve qu'aucun code n'a bougé ;
4. trigger `attestation_code_immutability` présent (pg_restore réinstalle le
   schéma).

### Banc d'essai sans base ni Docker

```bash
bash scripts/tests/test-backup-manifest-restore.sh
```

Le banc rejoue le flux complet sur des fichiers temporaires : sauvegarde
intègre acceptée, sauvegarde altérée après coup refusée, cible de production
refusée, manifeste retouché rejeté. Aucun dump n'est réellement restauré, aucune
connexion n'est ouverte.

## 5. Protection du code FSA (#255)

Défense en profondeur :

1. **Base (autoritaire)** — migration
   `prisma/migrations/20260927_attestation_code_immutability/migration.sql` :
   trigger `BEFORE UPDATE ON "Attestation"` qui refuse toute mise à jour où
   `NEW."code" IS DISTINCT FROM OLD."code"`.
   - additive, idempotent (`CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF
     EXISTS`) ;
   - non destructif : aucune ligne n'est lue ni modifiée par la migration, elle
     n'instancie aucun garde sur les attestations historiques ;
   - non disruptif : statuts, sceaux, PDF et liens restent modifiables ;
   - le message d'erreur contient le nom de l'exception
     (`ATTESTATION_CODE_IMMUTABLE`) et **jamais** la valeur du code.
2. **Applicatif** — `lib/attestations/code-guard.ts` :
   `assertCodeUnchanged()`, `withImmutableCode()` (retire `code` des données
   soumises) et `isAttestationCodeImmutableError()` pour traduire l'erreur du
   trigger en erreur métier. Le garde évite l'erreur en amont, le trigger la
   rend impossible.
3. **Test de non-régression** : aucun `create/update/upsert` Prisma du
   périmètre attestation n'écrit `code`
   (`tests/lib/attestations/code-guard.test.ts`).

## 6. Classification read-only et rapport déterministe (#259)

```bash
pnpm exec ts-node --project tsconfig.seed.json scripts/classify-attestation-migration.ts \
  --dry-run --report reports/fsa-migration-plan.json
```

- **read-only** : snapshot chargé en transaction `READ ONLY`, aucun appel
  Prisma d'écriture dans le script, le chargeur ou le module de classification ;
  `--apply` est refusé (aucun chemin d'écriture n'existe).
- **déterministe** : enregistrements triés par empreinte, findings triés, deux
  exécutions sur le même snapshot produisent le même rapport (seul
  `generatedAt` varie).
- **sans PII** : empreintes tronquées, aucun nom, email, lieu de naissance, clé
  d'objet ni sceau ; `redactMigrationReport()` bloque la publication si un champ
  sensible réapparaît.
- **catégories** : `LEGACY_UNSEALED`, `SEALABLE_WITH_EVIDENCE`, `REISSUE`,
  `REVOKED`, `REQUIRES_REVIEW`, `MIGRATION_BLOCKED` (+ `NO_ACTION_REQUIRED`
  pour une ligne déjà conforme — nommer une ligne déjà scellée « sealable »
  serait faux).

### Période inversée : bloquante jusqu'à validation métier

Une attestation dont `startDate > endDate` est classée `MIGRATION_BLOCKED` avec
le bloquant `PERIOD_INVERTED` (finding `CRITICAL`). Corriger les dates
réécrirait un document probant sans preuve : la ligne reste **figée**, en revue
métier, sans aucune action automatique. Idem pour
`ISSUED_BEFORE_PERIOD_END` et `BIRTH_AFTER_START`. Toute levée de blocage exige
une décision métier tracée ; l'outil ne dispose d'aucun chemin d'écriture.

## 7. Preuve publique (échantillon contrôlé)

Pour un échantillon d'attestations contrôlé : `GET /api/verifier?code=…`
(présence du code, statut, sceau) et chargement du PDF officiel
(`/api/attestations/[id]/pdf`) après validation. Cette vérification est
manuelle et hors des tests automatisés : elle exige un code réel et n'est jamais
rejouée en CI. Voir `tests/verifier-routes.test.ts` pour les invariants de la
route publique.

## 8. Récapitulatif des commandes

| Besoin | Commande |
| --- | --- |
| Inventaire de référence | `scripts/check-data-integrity.ts --dry-run --baseline …` |
| Export de référence (sans PII) | `scripts/export-reference.ts --out …` |
| Empreinte reproductible | `scripts/export-reference.ts --print-digest` |
| Manifeste de sauvegarde | `scripts/backup-manifest.ts --dir … --out …` |
| Vérification + plan de restauration | `scripts/verify-backup-restore.ts --manifest … --dir …` |
| Plan de migration (read-only) | `scripts/classify-attestation-migration.ts --dry-run` |
| Banc local manifeste/restauration | `bash scripts/tests/test-backup-manifest-restore.sh` |
| Sauvegarde production (inchangée) | `scripts/vps-pre-deploy-backup.sh` |
