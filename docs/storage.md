# Stockage des fichiers (uploads)

> Issue : #149 — remplacer l'écriture dans le filesystem du conteneur par un
> stockage objet survivant aux redéploiements.

## 1. Problème résolu

`app/api/upload/route.ts` écrivait dans `public/uploads`. Dans un conteneur
Docker, ce répertoire est éphémère : tout fichier uploadé était perdu au
redéploiement (CV de demande de stage, images). Le stockage est désormais
délégué à une abstraction `lib/storage/`.

## 2. Architecture

```
app/api/upload/route.ts
        │  validateUpload()  (taille, MIME déclaré, magic bytes)
        ▼
lib/storage/index.ts  ── createStorage() ──┬── lib/storage/s3-driver.ts    (S3 / R2 / MinIO)
                                           └── lib/storage/local-driver.ts (dev / volume persistant)
```

- `lib/storage/types.ts` — contrat `StorageDriver` (`put`, `getSignedUrl`,
  `delete`, `exists`) + garde anti path-traversal (`assertSafeKey`).
- `lib/storage/validation.ts` — source unique de vérité : 5 Mo max, types
  `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, détection des
  magic bytes, extension canonique.
- `lib/storage/index.ts` — factory `getStorage()` mémoïsée + `buildObjectKey()`.
- `lib/storage/migrate.ts` — reprise des fichiers existants.

Les clés logiques ont la forme `<sous-dossier>/<id><ext>` :
- PDF → `cv/<id>.pdf`
- images → `images/<id>.png`

## 3. Configuration

Voir `.env.example` (section « STOCKAGE OBJET »). Variables :

| Variable | Rôle |
|---|---|
| `STORAGE_DRIVER` | `auto` (défaut), `s3` ou `local` |
| `S3_BUCKET` | bucket cible (active S3 en mode `auto`) |
| `S3_REGION` | région (`auto` pour R2) |
| `S3_ENDPOINT` | endpoint S3-compatible (R2, MinIO…) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | identifiants |
| `S3_FORCE_PATH_STYLE` | `true` pour MinIO |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | durée de vie des URL signées (défaut 7 j) |
| `S3_PUBLIC_BASE_URL` | URL publique d'un bucket public-read (optionnel) |
| `STORAGE_LOCAL_DIR` | racine du driver local |
| `STORAGE_ALLOW_LOCAL_IN_PRODUCTION` | opt-in explicite du local en prod |

### Garde production

En `NODE_ENV=production`, la factory **refuse** :

- le stockage local sans opt-in (`STORAGE_ALLOW_LOCAL_IN_PRODUCTION=true`) ;
- un `STORAGE_LOCAL_DIR` situé dans `public/`.

→ Aucune écriture dans `public/uploads` en production.

## 4. API

`POST /api/upload` (auth requise) — `multipart/form-data`, champ `file`.

Réponse `201` :

```json
{
  "url": "https://…/cv/ab12cd34ef.pdf?X-Amz-Signature=…",
  "key": "cv/ab12cd34ef.pdf",
  "filename": "mon-cv.pdf",
  "size": 12345,
  "type": "application/pdf"
}
```

`DELETE /api/upload?key=cv/ab12cd34ef.pdf` (auth requise) — supprime l'objet.

### ⚠️ URL signée et expiration

`url` est une URL signée dont la validité est bornée par
`STORAGE_SIGNED_URL_TTL_SECONDS`. Les appelants qui stockent cette URL en base
(ex. `InternshipRequest.cvUrl`) doivent conserver aussi `key` afin de
re-signer à la demande. Une route de service (`GET /api/files/...`) qui
re-signe à la volée est le prolongement naturel de cette abstraction, hors
périmètre de #149.

## 5. Reprise des fichiers existants

```bash
# Inventaire sans écriture
npx tsx lib/storage/migrate.ts --dir public/uploads --dry-run

# Migration réelle (les fichiers sources sont conservés)
npx tsx lib/storage/migrate.ts --dir public/uploads

# Migration + suppression des sources
npx tsx lib/storage/migrate.ts --dir public/uploads --delete-local
```

Le script conserve le chemin relatif comme clé (`cv/xxx.pdf`), donc l'objet
reste identifiable depuis l'ancienne URL `/uploads/cv/xxx.pdf`. Il **ne
modifie pas la base** : les références métier (`cvUrl`, `pdfUrl`…) restent à
mettre à jour côté application.

## 6. Développement local

Pour les procédures de sauvegarde, restauration, versioning et alerting R2,
voir [`r2-operations.md`](r2-operations.md) (scripts + tests locaux + codes de
sortie). Ces scripts sont volontairement hors des routes applicatives et ne
contiennent aucune donnée de production.

Sans `S3_BUCKET`, le driver local écrit dans `public/uploads` et renvoie
`/uploads/<clé>` (comportement identique à avant). Avec MinIO :

```yaml
# docker compose
minio:
  image: minio/minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  ports: ["9000:9000", "9001:9001"]
```

```bash
STORAGE_DRIVER=s3
S3_BUCKET=uploads
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

## 7. Taxonomie des clés et registre `StoredObject` (#260)

`lib/storage/keys.ts` est la source unique de vérité de la nomenclature des
objets, avec un préfixe **disjoint par usage** (aucun préfixe partagé) :

| Usage (`StoragePurpose`) | Préfixe physique | Nature |
| --- | --- | --- |
| `cv` | `cv/` | pièce personnelle, supprimable |
| `internship` | `stages/` | pièce annexe, supprimable |
| `attestation` | `attestations/` | **pièce probante immuable** |
| `export` | `exports/` | rendu massif, supprimable |
| `temporary` | `temporary/` | jetable |

Invariants :

- une clé est **stable** et persistée en base — jamais une URL signée
  (`looksLikeSignedUrl` rejette tout ce qui porte `X-Amz-`, `Signature=`,
  `token=` ou `Expires=`) ;
- l'extension vient du type MIME détecté, jamais du nom fourni par le client ;
- une clé d'attestation n'est jamais supprimable (`isOfficialObjectKey`).

`lib/storage/registry.ts` enregistre chaque objet dans la table
`StoredObject` (propriété, usage, entité liée, empreinte SHA-256, taille,
type MIME, fin de rétention) et applique les règles d'accès :

- lecture/suppression : propriétaire `ownerUserId` **ou** rôle administrateur
  (`assertOwnership`) ; un objet sans compte est réservé aux administrateurs ;
- objet officiel (`purpose = attestation` ou préfixe `attestations/`) :
  suppression interdite (`StoredObjectProtectedError`, HTTP 409) ;
- écriture idempotente sur `key` ; une clé hors préfixes autorisés est
  refusée (`StorageValidationError`, HTTP 400).

Durée de vie des URL signées : 60 s par défaut, 300 s maximum
(`normalizeReadUrlTtl`). Voir `lib/storage/keys.test.ts` et
`lib/storage/registry.test.ts` pour la preuve exécutable de ces invariants.

## 8. Périmètre / suites

- Les scans de composition (`app/api/admin/submissions/[id]/scans/route.ts`)
  écrivent dans `private/uploads` (hors webroot) et **ne sont pas couverts**
  par cette abstraction — ils restent sur le filesystem et devront migrer via
  une issue dédiée.
- Le manifeste Docker copie `public/` dans l'image : un upload local en
  production serait de toute façon perdu, d'où la garde bloquante.
