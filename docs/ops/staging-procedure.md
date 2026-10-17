# Staging — procédure d'exploitation

> Instance isolée de pré-production. Une migration est **validée ici avant**
> d'atteindre la production. Cette procédure est le complément opératoire de
> `compose.staging.yml` et du job `deploy-staging` de `.github/workflows/deploy.yml`.

## 1. Ce que staging garantit

Le schéma est appliqué **deux fois** dans un déploiement normal :

```
build-and-push
      │
      ├─ deploy-staging   → base staging : prisma migrate deploy
      │                     puis smoke test HTTP sur /api/ready
      │                          │
      │                          └─ échec ⇒ la prod n'est PAS déployée
      ▼
deploy-prod  (déclenché uniquement si deploy-staging = success)
```

La condition est explicite dans `deploy.yml:104-106` et `deploy.yml:178-180` :
sur un `workflow_run` (donc à chaque passage de tests en vert),
`deploy-prod` exige `needs.deploy-staging.result == 'success'`.

Le seul moyen de sauter staging est un **déclenchement manuel avec
`skip_staging=true`** — un choix explicite, jamais un effet de bord.

Conséquence : une migration cassée est détectée sur une base jetable, avant
d'atteindre les données réelles.

## 2. Ce qui est isolé, et ce qui ne l'est pas

| Ressource | Prod | Staging | Isolé |
| :--- | :--- | :--- | :--- |
| Base PostgreSQL | `attestations-fsa-postgres-prod` | `attestations-fsa-postgres-staging` (port 5434) | ✅ |
| Volumes d'uploads | `fsa-uploads-{public,private}` | `fsa-uploads-{public,private}-staging` | ✅ |
| Secrets | `.env.production` | `.env.staging` | ✅ |
| Domaine | `TRAEFIK_HOST` | `STAGING_HOST` | ✅ |

**Non isolé :** le bucket R2 / S3 et le compte Resend sont configurés par les
mêmes variables d'environnement que la prod tant qu'on ne fournit pas de
jeu de clés distinct. Vérifier `S3_BUCKET` et `RESEND_*` dans `.env.staging`
avant de téléverser une donnée réelle.

## 3. Créer `.env.staging`

Le fichier est **ignoré par git** (règle `.env*`), donc jamais committé.
Modèle : `compose.staging.yml` liste chaque variable attendue sous le préfixe
`STAGING_` (`STAGING_POSTGRES_PASSWORD`, `STAGING_AUTH_SECRET`,
`STAGING_BETTER_AUTH_SECRET`, `STAGING_RESEND_API_KEY`, `STAGING_UPSTASH_*`…).

```bash
cp .env.example .env.staging   # puis renseigner les secrets
chmod 600 .env.staging
```

`TODO(humain)` : générer les secrets avec `openssl rand -base64 32`.
Les identifiants Postgres staging doivent différer de ceux de la prod.

## 4. Déployer

```bash
# Via l'interface GitHub : onglet Actions → deploy.yml → Run workflow
#   → skip_staging = false (défaut)
gh workflow run deploy.yml -f skip_staging=false
```

Suivre le job `deploy-staging` : démarrage du Postgres, attente de
`pg_isready`, application des migrations, démarrage de l'app, smoke test HTTP
sur `/api/ready`.

## 5. Vérifier avant de SEND TO PROD

```bash
# Sur le VPS
docker compose --env-file .env.staging -f compose.staging.yml ps
docker compose --env-file .env.staging -f compose.staging.yml \
  logs --tail=80 fsa-app-staging
curl -fsS https://staging.<domaine>/api/ready | jq
```

`/api/ready` agrège l'état de la base et de Redis et renvoie `ready` ou
`degraded`. Un `degraded` doit être investigué **avant** la prod.

Points d'attention spécifiques aux migrations :

- Les migrations destructives sont **bloquées en amont** par
  `scripts/check-destructive-migrations.mjs`, branché sur `pnpm verify`. Une
  migration refusée ici ne partira ni en staging ni en prod.
- Après application, comparer le schéma obtenu au `schema.prisma` attendu :
  `prisma migrate status` doit indicar la base à jour.

## 6. Stratégie de rollback — décision explicite

| Plan | Couvert | Non couvert |
| :--- | :--- | :--- |
| Rollback **image** (`deploy.yml`, job `rollback`) | Version applicative | **Le schéma** |
| Restauration d'un **dump** | Le schéma et les données | Impose une indisponibilité et perd les écritures depuis le dump |
| **Prévention** (retenue) | Migration destructive bloquée avant déploiement | — |

**Aucun rollback base automatique n'est mis en place, volontairement.**
Restaurer une base de production est une opération plus dangereuse que le
problème qu'elle corrige : elle révoque l'accès à la donnée écrite pendant la
fenêtre d'indisponibilité, sur une plateforme où les attestations sont des
**pièces probantes**.

La stratégie retenue est donc **prévenir plutôt que réparer** :

1. migration destructive → refusée par le garde, avant tout déploiement ;
2. migration douteuse → testée sur la base staging, qui est jetable ;
3. incident avéré en prod → rollback image, puis restauration manuelle du
   dump **en décision explicite**, jamais en automatique.

Le filet de données existe et est éprouvé : `pnpm drill:restore` restaure
réellement une sauvegarde dans une base isolée et compare table par table.

## 7. Sauvegarde avant migration sur staging

Staging est **volontairement sans sauvegarde** : la base est jetable et
reconstruisible. Le backup pré-migration (`scripts/vps-pre-deploy-backup.sh`,
fail-closed et avec vérification de restaurabilité) ne s'applique qu'à la
production, où il est **bloquant**.