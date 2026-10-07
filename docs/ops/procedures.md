# Procédures d'exploitation — FSA Attestations

Complément du [`runbook-incident.md`](runbook-incident.md). Commandes ancrées sur les fichiers
réels (références `fichier:ligne`). `TODO(humain)` = information absente du dépôt, à ne pas
inventer.

**Rappel structurant : un merge sur `main` = un déploiement en production**
(`.github/workflows/deploy.yml:3-7`). Il n'y a pas de gate manuel dans le workflow.

---

## 1. Déploiement

### 1.1 Voie normale : merge sur `main` (CI)

Avant de merger → [`checklist-mise-en-production.md`](checklist-mise-en-production.md).

Ce que fait le pipeline (`deploy.yml`), à distance en SSH sur l'hôte de production
(secrets GitHub `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` — `deploy.yml:28-31`) :

| Étape | Commande réellement exécutée | Réf |
|---|---|---|
| 1. Récupérer le code | `git pull origin $(git rev-parse --abbrev-ref HEAD)` dans `/home/audest/attestations-fsa` | `deploy.yml:36-39` |
| 2. Démarrer la base | `docker compose --env-file .env.production -f compose.prod.yml up -d fsa-postgres` | `deploy.yml:45` |
| 3. Attendre `pg_isready` | boucle 30 × 2 s (`docker exec attestations-fsa-postgres-prod pg_isready -U attestation_fsa_user -d attestation_fsa`) | `deploy.yml:48-54` |
| 4. **Backup pré-migration (bloquant)** | `BACKUP_DIR=/home/audest/backups/attestation-fsa bash scripts/vps-pre-deploy-backup.sh` | `deploy.yml:56-59` |
| 5. Schéma | `docker compose --env-file .env.production -f compose.prod.yml --profile tools run --rm prisma migrate deploy` | `deploy.yml:63` |
| 6. Seed initial uniquement | si `SELECT COUNT(*) FROM "User"` = 0 et `Backup/deploy-dump.sql` présent → `psql … < Backup/deploy-dump.sql` | `deploy.yml:66-85` |
| 7. Coupure + rebuild | `docker compose … down` puis `docker compose … up -d --build --wait` | `deploy.yml:89-92` |
| 8. État | `docker compose … ps` | `deploy.yml:95` |

⚠️ Étape 7 = **interruption courte à chaque déploiement**. Le `--wait` ne rend la main que
quand le healthcheck `/api/health` passe (`compose.prod.yml:61-69`).

Suivi : onglet Actions du dépôt `https://github.com/digitaleflex/attestations-fsa`
(URL du remote citée `docs/README.md:31`).

### 1.2 Déclenchement manuel (rebuild sans push)

`deploy.yml:8-14` : workflow `Deploy to VPS (Docker)` → **Run workflow**, entrée `skip_db`
(booléen, « Skip database restore »). Usage : relancer un build à code constant, ou éviter
la phase de seed. Le seed ne s'applique que si la table `User` est vide (`deploy.yml:71`) —
sur une base de prod peuplée, `skip_db` change peu de chose ; le garder à `false` par défaut.

### 1.3 Voie manuelle depuis un poste opérateur : `deploy-to-vps.sh`

`scripts/deploy-to-vps.sh` — usage : premier déploiement, ou secours si la CI est indisponible.
Lit la config du `.env.production` **local** (`deploy-to-vps.sh:22-31` ; exige `VPS_HOST`,
`VPS_USER` — `deploy-to-vps.sh:77-78`).

```bash
./scripts/deploy-to-vps.sh              # complet : dump local → transfert → setup → restore → build
./scripts/deploy-to-vps.sh --app-only   # build & restart Docker uniquement (pas de DB)  :49-57
./scripts/deploy-to-vps.sh --skip-dump  # réutilise le SQL existant                       :49-57
```

⚠️ Différences avec la CI, à connaître avant d'improviser :
- chemin d'app par défaut `/home/audest/attestation-fsa` (singulier, `deploy-to-vps.sh:37`)
  vs `/home/audest/attestations-fsa` pour la CI (`deploy.yml:36`) —
  `TODO(humain): confirmer/harmoniser les deux chemins ; quel répertoire est réellement déployé ?`
- il **crée un `.env` sur le VPS s'il n'existe pas** avec des secrets générés
  (`deploy-to-vps.sh:156-189`) — sur une prod existante, `.env` existe déjà, la branche est
  sautée ; ne pas supprimer ce fichier pour « repartir propre » (nouveaux secrets = sessions
  et OTP chiffrés potentiellement orphelins, voir § 4) ;
- il restaure un dump **seulement si la base a < 5 tables** (`deploy-to-vps.sh:218-235`).

### 1.4 Vérification post-déploiement (quelle que soit la voie)

```bash
# Sur le VPS :
cd /home/audest/attestations-fsa && \
  docker compose --env-file .env.production -f compose.prod.yml ps   # tout Up + healthy
# De l'extérieur (gabarit) :
curl -fsS https://<DOMAINE-DE-PRODUCTION>/api/health    # 200 (liveness, sans dépendance)
curl -fsS https://<DOMAINE-DE-PRODUCTION>/api/ready     # 200 (la base est joignable)
```
Puis fumées : `/verifier` avec un code connu ; une connexion OTP
(`TODO(humain): compte + code de test dédiés`).

---

## 2. Rollback

**Constat : aucun mécanisme de rollback n'existe dans la CI** (aucun job de revert dans
`deploy.yml`). Les trois leviers ci-dessous sont les seuls réels.

### 2.1 Rollback applicatif propre : `git revert` (recommandé)

1. Identifier le commit fautif (Actions run → commit mergé, `deploy.yml:39`).
2. `git revert <SHA-du-merge>` sur une branche, PR, review, **merge sur `main`** → la CI
   redéploie l'état antérieur (§ 1.1). C'est le seul chemin durable, car la CI fait
   `git pull origin <branche-courante-du-VPS>` à chaque run : tout état manuel sur le VPS est
   écrasé au merge suivant (`deploy.yml:39`).
3. Si la migration Prisma du deploy fautif a déjà tourné : **le schéma ne revient pas tout
   seul** — `prisma migrate deploy` n'a pas de « down » automatique. Deux options :
   correctif forward (migration additive), ou restauration de données (§ 2.3). Décision :
   `TODO(humain): décideur + critères`.

### 2.2 Rollback applicatif d'urgence sur le VPS (jetable, à annoncer)

Quand la latence d'une PR est impossible (P0) — gabarit, reconstruit l'image de l'ancien
commit avec les commandes du § 1.1 :

```bash
cd /home/audest/attestations-fsa
git fetch origin
git checkout <SHA-PRECEDENT>                                   # <à remplacer>
docker compose --env-file .env.production -f compose.prod.yml up -d --build fsa-app
```

⚠️ Ce n'est pas un état stable : le prochain merge sur `main` remettra le commit fautif si le
revert n'a pas été fait. À convertir en § 2.1 dans la foulée. Attention aux variables
`NEXT_PUBLIC_*` : elles sont **bakées au build** (`Dockerfile:21-27`) — un rollback d'image
sans `--build` avec de nouveaux args compose ne les change pas.

### 2.3 Rollback des données : restauration d'un backup pré-deploy

Chaque deploy crée `db-backup-<horodatage>.dump` (+ `.sha256`) dans
`/home/audest/backups/attestation-fsa`, rétention 10 (`vps-pre-deploy-backup.sh:43,247-248`).

```bash
# 1. Lister et choisir le dump le plus récent ANTÉRIEUR à la corruption :
ls -lt /home/audest/backups/attestation-fsa
# 2. Vérifier l'intégrité (fichier .sha256 créé par le script, ligne 58) :
cd /home/audest/backups/attestation-fsa && sha256sum -c <db-backup-XXXX.dump.sha256>   # <à remplacer>
# 3. Restaurer dans le conteneur de prod — GABARIT (aucun script de restauration .dump
#    n'existe dans le dépôt ; c'est le pendant pg_restore du pg_dump -Fc du script de backup) :
docker exec -i attestations-fsa-postgres-prod \
  pg_restore -U attestation_fsa_user -d attestation_fsa --clean --if-exists \
  < /home/audest/backups/attestation-fsa/<db-backup-XXXX.dump>
```

Préalables bloquants : backup frais de l'état actuel d'abord (au cas où), décision de l'astreinte
N2, acceptation de **perdre toutes les écritures après l'horodatage du dump**.
`TODO(humain): créer scripts/vps-restore-backup.sh pour industrialiser ce gabarit + premier
exercice à blanc.`

**Ne pas confondre** avec `scripts/vps-restore-dump.sh` : celui-ci cible un PostgreSQL **host**
(`sudo -u postgres psql`) et **DROP la base** (`vps-restore-dump.sh:22-27`) ; il sert à la
migration initiale, pas à la récupération d'incident sur le conteneur Docker.

### 2.4 Rollback d'image « à l'ancienne » ?

Non applicable tel quel : l'image est reconstruite sur le VPS à chaque deploy
(`up -d --build`, `deploy.yml:92`) sans tag de version exploitable dans le dépôt. L'ancien
tag survit parfois en image dangling (`docker images`) — s'en servir est un dépanage
extrêmement fragile, pas une procédure.

---

## 3. Mise en maintenance / dégradation

**Constat : aucun mode maintenance applicatif n'existe** (grep `maintenance` : uniquement du
texte CGU dans `app/(public)/legal/cgu/page.tsx:56`). La dégradation se fait donc à
l'infra, avec une coupure franche — Traefik renverra une erreur 502/503, pas une page
jolie. `TODO(humain): décider d'une page de maintenance (Traefik ?) et du canal d'annonce.`

### 3.1 Fenêtre de maintenance (planifiée)

```bash
# Sur le VPS — arrêt propre de l'app, la base reste disponible :
cd /home/audest/attestations-fsa
docker compose --env-file .env.production -f compose.prod.yml stop fsa-app
# ... opérations (migrations à la main, restauration, etc.) ...
docker compose --env-file .env.production -f compose.prod.yml up -d fsa-app
# Vérification : § 1.4
```
`stop_grace_period: 30s` pour l'app (`compose.prod.yml:79`) : prévoir ~30 s de drain.

### 3.2 Dégradation choisie (couper une fonction pour sauver le reste)

| Couper | Comment | Effet |
|---|---|---|
| L'app (surcharge) | `docker compose … restart fsa-app` (voir runbook Incident 4) | coupure courte, purge l'état mémoire (OTP logs, compteurs fallback) |
| Les emails | retirer `RESEND_API_KEY` de `.env.production` + recréer fsa-app | **ne le faites pas** : l'envoi lève une erreur en prod (`lib/email-health.ts:41-50`), les flux OTP/reset/2FA cassent — couper l'email = couper la connexion des candidats |
| Tout (VPS à plat) | `docker compose … down` **sans `-v`** | arrêt total ; `-v` est interdit (supprime le volume DB, `compose.prod.yml:153-159`) |

---

## 4. Rotation de secrets

⚠️ Citez des **noms** de variables, jamais des valeurs. Génération d'un secret :
`openssl rand -base64 32` (motif : `.env.example:14`, `deploy-to-vps.sh:161-162`).

### 4.1 Où vivent les secrets (cartographie réelle)

| Emplacement | Contenu | Réf |
|---|---|---|
| `/home/audest/attestations-fsa/.env.production` (VPS) | secrets runtime injectés dans les conteneurs | `deploy.yml:45` (`--env-file .env.production`), `compose.prod.yml:32-52` |
| Secrets du dépôt GitHub (environment `production`) | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` | `deploy.yml:19,28-31` |
| `~/.config/attestations-fsa/backup.env` (VPS) | `BACKUP_REMOTE` (rclone), `BACKUP_AGE_RECIPIENT` (clé publique age) — c'est là que se pose aussi `NODE_ENV=production` qui rend l'offsite bloquant (§ 5.5) | `vps-pre-deploy-backup.sh:28-34` |
| Fournisseurs amont | clés Resend / Upstash / Pusher (les **valeurs** sont dans .env.production) | `.env.example:18-68` |

### 4.2 Séquence standard

1. Créer le nouveau secret **chez le fournisseur** (ou le générer).
2. Mettre à jour `.env.production` sur le VPS (éditer, ne pas committer).
3. **Redémarrer les services qui lisent ces variables** — elles sont lues au démarrage du
   process (`lib/auth.ts:29`, `lib/redis.ts:7`, `lib/email.ts:7-23`) :
   ```bash
   cd /home/audest/attestations-fsa
   docker compose --env-file .env.production -f compose.prod.yml up -d --force-recreate fsa-app
   ```
   (`--force-recreate` : gabarit — les commandes compose de base viennent de `deploy.yml:89-92`.)
4. Vérifier (`/api/health`, `/api/ready`, un envoi OTP de test).
5. **Révoquer l'ancien secret** chez le fournisseur seulement après vérification.

Cas particulier **`NEXT_PUBLIC_*`** (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PUSHER_KEY`,
`NEXT_PUBLIC_PUSHER_CLUSTER`) : valeurs **bakées au build** (`Dockerfile:21-27`, passées en
`build.args` par `compose.prod.yml:13-16`) → un simple restart ne suffit pas, il faut
`up -d --build`.

### 4.3 Par secret

| Secret | Impacts à connaître | Service(s) à redémarrer |
|---|---|---|
| `BETTER_AUTH_SECRET` / `AUTH_SECRET` | l'app **refuse de démarrer** sans eux en prod (`lib/auth.ts:29-34`) ; les OTP/backup-codes 2FA sont stockés **chiffrés** en prod (`lib/auth.ts:137,142-143`) — l'effet d'une rotation sur les valeurs déjà chiffrées **n'est pas vérifié dans ce dépôt**. `TODO(humain): tester en staging l'impact sur sessions actives et 2FA.` | fsa-app (restart) |
| `RESEND_API_KEY` | sans clé, tout envoi lève une erreur en prod (`lib/email-health.ts:41-50`) | fsa-app (restart) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | les deux absents/invalides → fallback mémoire du rate-limit (`lib/redis.ts:6-16`, `lib/rate-limit.ts:326-336`) | fsa-app (restart) |
| `PUSHER_*` (+ `NEXT_PUBLIC_PUSHER_*`) | notifications temps réel ; les clés publiques sont dans le bundle → rebuild (voir § 4.2) | fsa-app (**--build**) |
| `POSTGRES_PASSWORD` (VPS `.env.production`) | ⚠️ **piggyback trap** : changer la variable ne change PAS le mot de passe dans la base existante (initialisé à la création du volume). Séquence : (a) `docker exec attestations-fsa-postgres-prod psql -U attestation_fsa_user -d postgres -c "ALTER USER attestation_fsa_user WITH PASSWORD '<nouveau>'"` (gabarit — nom du conteneur/usager : `compose.prod.yml:87,90`, pattern `docker exec … psql -U …` : `deploy.yml:67-69`) ; (b) mettre la même valeur dans `.env.production` ; (c) recréer fsa-app (`DATABASE_URL` est construit avec cette variable, `compose.prod.yml:33`). Un ordre inversé verrouille l'app hors de sa base. | fsa-app (restart) ; fsa-postgres sans redémarrage nécessaire pour ALTER USER |
| `VPS_SSH_KEY` (secret GitHub) | la CI perd l'accès → plus aucun deploy. Mettre à jour la clé publique dans `authorized_keys` sur le VPS **avant** de révoquer l'ancienne. | aucun conteneur (CI uniquement) |
| `ADMIN_USER_IDS` | pas un secret à proprement parler (UUIDs admin, `lib/auth.ts:113-118`) mais changer la valeur modifie qui est admin → recréer fsa-app | fsa-app (restart) |
| Clé **privée** age des backups | son emplacement n'est pas documenté dans le dépôt. `TODO(humain): où est-elle gardée ? qui peut la régénérer ?` Si perdue : les backups offsite chiffrés age sont illisibles. | — |

### 4.4 Cadence

`TODO(humain): définir une politique (durée max, gilets de sauvetage, rotation post-départ
d'une personne ayant accès au VPS).` En attendant : rotation systématique en cas de doute
(runbook Incident 3).

---

## 5. Sauvegarde et restauration

### 5.1 Sauvegardes existantes (vérifiées dans le code)

| Type | Quoi | Où | Déclenchement |
|---|---|---|---|
| Dump custom `pg_dump -Fc` | base entière | `/home/audest/backups/attestation-fsa/db-backup-*.dump` + `.sha256`, rétention 10 | **à chaque deploy CI** (`deploy.yml:56-59`) ; script standalone `bash scripts/vps-pre-deploy-backup.sh` |
| Archives des volumes d'uploads | `public/uploads` + `private/uploads` (CV/images + **scans d'examen**) en `.tar.gz` + `.sha256` | même répertoire, `uploads-<label>-<horodatage>.tar.gz` | même déclencheur (le script archive les deux volumes, `vps-pre-deploy-backup.sh:174-219`) |
| **Offsite chiffré — NON automatique, à activer (§ 5.5)** | dump + archives, en `.age` (jamais en clair dès que l'offsite est exigé) via `rclone copy` | `BACKUP_REMOTE` | à chaque deploy **si et seulement si** `BACKUP_REMOTE` + `BACKUP_AGE_RECIPIENT` sont configurés (§ 5.5) |
| Dump JSON logique | tables sans mots de passe ni tokens de session (`db-dump.ts:40-100`) | `Backup/db-dump-<ts>.json` (gitignoré, `.gitignore:65`) | manuel : `node scripts/db-dump.ts` |
| SQL depuis le JSON | INSERT compatibles | stdout | `node scripts/json-to-sql.mjs <dump.json> > Backup/deploy-dump.sql` (motif `deploy-to-vps.sh:113-118`) |

⚠️ **L'offsite n'est PAS automatique.** Tant que les variables du § 5.5 ne sont pas
posées, un deploy ne produit **que** des copies locales sur le même VPS : le jour où la
machine brûle, ces copies brûlent avec elle. Depuis le durcissement #306, l'absence
d'offsite **fait échouer** le deploy au lieu de n'émettre qu'un avertissement
(`vps-pre-deploy-backup.sh:64-111`) — mais **seulement si `NODE_ENV=production` est
effectif dans l'environnement du script** (voir la limite § 5.5).

`TODO(humain): le cron quotidien suggéré par le commentaire du script
(0 3 * * * cd /home/audest/attestations-fsa && ./scripts/vps-pre-deploy-backup.sh,
vps-pre-deploy-backup.sh:9-10) est-il réellement installé ? Vérifier avec crontab -l et
documenter ici.`

### 5.2 Restauration

- Dump `.dump` (custom) → gabarit `pg_restore` du § 2.3 (aucun script dédié n'existe).
- Dump SQL plat → la CI ne le réinjecte que si la base est **vide** (`deploy.yml:66-85`) ;
  pour un peuplement manuel sur conteneur : motif `deploy.yml:74-75`
  (`docker exec -i attestations-fsa-postgres-prod psql -v ON_ERROR_STOP=1 -U attestation_fsa_user -d attestation_fsa < Backup/deploy-dump.sql`) —
  **ne pas** l'exécuter sur une base non vide sans décision (INSERT en doublon/erreur).
- Après toute restauration : redémarrer fsa-app, puis § 1.4 + vérification du vérifieur
  public avec un code connu.

### 5.3 Environnement local de test (pour s'exercer sans risque)

```bash
./scripts/docker-local-setup.sh     # PG local via compose.local.yml + nettoyage/restore du dump + migrations
```
(`docker-local-setup.sh:12-33` ; chaîne : `fix-dump-for-local-postgres.sh` →
`docker-local-restore.sh` (lit `Backup/dump-complet-clean.sql`) → `docker-local-migrate.sh`
(image `Dockerfile.prisma`).) C'est l'infrastructure pour l'**exercice à blanc** de
restauration exigé par la checklist — `TODO(humain): première exécution datée et consignée ici`.

### 5.4 Scripts de migration initiale (contexte historique, NE PAS utiliser en incident)

`migrate-to-vps.sh` (steps `dump|setup-db|restore|migrate|validate|env|full`),
`vps-setup-postgres.sh` (PostgreSQL 17 host, hors Docker), `vps-restore-dump.sh`
(restore host avec `DROP DATABASE`), `export-docker-volume.sh` (dump du volume local →
`Backup/docker-dump-*.sql` + variante nettoyée), `import-json-to-postgres.sh`.
Leur raison d'être : le transfert Prisma Postgres → PostgreSQL self-hosted
(`MIGRATION-GUIDE.md`). Piège commun : les dumps issus de Prisma Postgres contiennent
l'extension `prisma_postgres` que seul `fix-dump-for-local-postgres.sh` retire
(`fix-dump-for-local-postgres.sh:19-30`, `MIGRATION-GUIDE.md:272-277`).

### 5.5 Activer la sauvegarde hors site chiffrée (#306)

**L'offsite n'est pas un effet de bord du backup : c'est une configuration, et elle n'existe
pas tant qu'un humain ne l'a pas posée.** Aucune valeur secrète n'est écrite dans ce document ;
seules les commandes et les noms de variables le sont.

#### 5.5.1 État au moment de la rédaction (constaté, re-vérifiable)

Relevé sur l'hôte `/home/audest` (secrets non reproduits) :

```bash
command -v rclone && rclone version | head -1   # → présent
command -v age || echo "ABSENT"                 # → ABSENT : rien ne peut être chiffré
cut -d= -f1 ~/.config/attestations-fsa/backup.env   # → BACKUP_REMOTE présent,
                                                   #   BACKUP_AGE_RECIPIENT commenté
```

Conséquence tant que ce n'est pas corrigé : le script **envoie le dump et les archives
d'uploads en clair** vers le bucket (le `WARN` de `vps-pre-deploy-backup.sh:126-139` le dit,
mais l'upload part quand même). Des données nominatives de candidats et des scans d'examen
traversent alors le réseau en clair.

#### 5.5.2 Ordre des opérations (l'ordre compte)

1. **Clé `age` — sur une machine de confiance, jamais sur le VPS de production.**
   ```bash
   # UNE SEULE FOIS, sur le poste qui portera l'escrow :
   age-keygen -o ~/fsa-backup-age.key      # → age1… (privé) + .pub (public)
   # La clé PRIVÉE ne doit JAMAIS être sur le VPS ni dans le bucket.
   cat ~/fsa-backup-age.key.pub            # → la valeur à mettre dans BACKUP_AGE_RECIPIENT
   ```
   `TODO(humain) — ESCROW : où est conservée la clé privée, qui d'autre peut la lire, comment
   est-elle testée avant chaque exercice de restauration ? Personne ne peut déchiffrer les
   sauvegardes hors site sans elle ; le § 4.3 la signale déjà comme non documentée.`

2. **`age` sur l'hôte de production** (le refuse est bloquant dès que `NODE_ENV=production`) :
   ```bash
   sudo apt-get install -y age
   age --version
   ```

3. **Remote `rclone`** (le bucket doit déjà exister, hors du dépôt) :

   **Option recommandée — Backblaze B2 :**
   ```bash
   # 1. Créer un bucket sur backblaze.com → B2 Cloud Storage → Create Bucket
   #    Nom : fsa-backups | Files are Private
   # 2. Créer une Application Key (keyID + applicationKey)
   # 3. Configurer rclone :
   rclone config
   # → n (nouveau remote) → name: b2-fsa → Storage: Backblaze B2
   # → account: <keyID> → key: <applicationKey> → endpoint: (vide)
   rclone lsd b2-fsa:       # doit lister le bucket
   ```

   **Alternative — DigitalOcean Spaces :**
   ```bash
   rclone config
   # → n → name: spaces → Storage: DigitalOcean Spaces
   # → access_key_id / secret_access_key → region: ams3
   rclone lsd spaces:
   ```

   ⚠️ Choisir un bucket **d'un autre compte fournisseur** que le VPS : une sauvegarde
   copiée chez le même fournisseur, sur le même compte, ne protège pas de la perte du compte.

4. **Fichier de configuration** — l'unique source lue par le cron et par la CI
   (`vps-pre-deploy-backup.sh:28-34`), hors dépôt, `chmod 600` :
   ```bash
   install -d -m 700 ~/.config/attestations-fsa
   cat > ~/.config/attestations-fsa/backup.env <<'EOF'
   BACKUP_REMOTE="<remote rclone, ex. b2-fsa:fsa-backups>"
   BACKUP_AGE_RECIPIENT="age1..."
   # Rend le deploy CI fail-closed : la session SSH de deploy.yml n'exporte pas NODE_ENV,
   # mais elle charge ce fichier (set -a). Voir la limite ci-dessous.
   NODE_ENV=production
   EOF
   chmod 600 ~/.config/attestations-fsa/backup.env
   ```
   **Ne pas** mettre la clé privée ici, ni dans `.env.production` : `.env.example` ne déclare
   que `BACKUP_REMOTE` et `BACKUP_AGE_RECIPIENT`, et ces deux variables sont lues sur
   l'hôte (le script tourne en dehors de tout conteneur) — c'est pourquoi elles sont
   volontairement absentes de `compose.prod.yml`.

5. **Vérification sans déployer** (le script se refuse à démarrer si l'offsite est incomplet —
   c'est exactement le comportement attendu) :
   ```bash
   cd /home/audest/attestations-fsa
   NODE_ENV=production BACKUP_DIR=/tmp/essai-backup \
     bash scripts/vps-pre-deploy-backup.sh
   # Attendu : « ==> Offsite EXIGÉ et configuré : … » puis « ==> Offsite upload OK -> … »
   # Puis, hors ligne, la preuve que c'est bien chiffré ET lisible :
   rclone copy spaces:fsa-backups/<fichier>.age /tmp/essai-backup/
   age -d -i ~/fsa-backup-age.key /tmp/essai-backup/<fichier>.age > /tmp/essai-backup/verif.dump
   ( cd /tmp/essai-backup && sha256sum -c <fichier>.dump.sha256 )
   ```
   Un backup offsite jamais déchiffré ne vaut rien : cette vérification doit être refaite à
   chaque exercice, pas seulement à l'activation.

#### 5.5.3 Limite connue : l'indicateur `NODE_ENV=production`

Le blocage est conditionné à `NODE_ENV=production` (`vps-pre-deploy-backup.sh:79-80`), seul
indicateur de production déjà utilisé par le dépôt (`compose.prod.yml:48`,
`deploy-to-vps.sh:165`, `.env.example:67`). Or la session SSH de `deploy.yml:60-106` et la
ligne de cron n'exportent pas `NODE_ENV`. **Conséquence : tant que
`NODE_ENV=production` n'est pas dans `backup.env` (étape 4) ou dans l'environnement du
script, un deploy dont l'offsite est cassé n'échoue toujours pas — il n'affiche qu'un
`WARN`.** Trancher entre : (a) `NODE_ENV=production` dans `backup.env` (déjà écrit, aucun
changement de code), (b) ajouter l'export dans `deploy.yml:105-106` et dans le crontab.
`TODO(humain): choisir (a) ou (b) — le dépôt ne tranche pas.`

#### 5.5.4 À ARBITRER — RPO

> **À ARBITRER — RPO (perte de données maximale acceptable).** Aucune valeur n'est écrite ici
> à dessein : c'est une décision métier (direction + N2, cf. #305), pas une déduction
> technique. Le technique peut au contraire en proposer un, une fois les deux faits
> suivants établis :
> - les sauvegardes sont **créées à chaque déploiement** (`deploy.yml:105-106`) : sans cron,
>   le RPO est « depuis le dernier déploiement », ce qui peut couvrir plusieurs jours ;
> - la **rétention locale est de 10 générations** et la **rétention offsite n'est définie
>   nulle part** (`vps-pre-deploy-backup.sh:237-248` ne purge que le local) : un RPO de 24 h
>   est incompatible avec une rétention de 10 dumps si les déploiements sont rares.
>
> Emplacement de la décision : `docs/decisions-bloquantes.md` (#159) + issue #306, vague 6
> du `docs/ROADMAP.md`. Tant que ce n'est pas écrit, le RPO n'est pas connu et aucun
> dimensionnement de rétention ne peut être justifié.

#### 5.5.5 À ARBITRER — RTO

> **À ARBITRER — RTO (délai maximal de reprise acceptable).** Également non écrit ici à dessein.
> Le chemin de restauration existe (`pg_restore` du § 2.3) mais **n'est ni scripté ni
> exercité** : le § 2.3 est un gabarit, et le § 5.3 fournit l'infrastructure d'un exercice à
> blanc. Le RPO ci-dessus ne vaut que si le RTO est inférieur à la fenêtre d'indisponibilité
> acceptée.
> Élément de mesure à produire lors du premier exercice (§ 2.3 + `data-coherence-migration-design.md` §7.4) :
> temps de téléchargement du `.age`, temps de `age -d`, temps de `pg_restore`, temps de
> migrations, temps de démarrage + healthcheck. **Le RTO est le maximum observé, pas la
> moyenne** — et il doit être re-mesuré à chaque changement de taille de base.
>
> Emplacement de la décision : `docs/decisions-bloquantes.md` (#159) + issue #306, vague 6 du
> `docs/ROADMAP.md`. Premier exercice à dater et à consigner dans ce document (§ 5.3).

---

## 6. Observabilité

> **Note** : aucune remontée d'erreur vers un tiers. Les erreurs applicatives
> sont journalisées via le `console` serveur (`console.error` dans
> `handleApiError`, `lib/error-handler.ts`) et se lisent dans les logs Docker
> du conteneur `fsa-app` ; la readiness (base joignable) est exposée sur
> `/api/ready` (voir § 1.4).

### 6.1 Uptime externe — détection de panne

Aucun monitoring externe n'est configuré : si le VPS tombe, personne n'est alerté. Le healthcheck
Docker (`compose.prod.yml:94-103`, sur `/api/ready`) ne fait que redémarrer le conteneur — il ne
prévient personne.

#### 6.1.1 Configurer Better Stack (recommandé)

1. Créer un compte sur https://betterstack.com (plan gratuit : 50 monitors, 1 min d'intervalle).
2. **Uptime → Add Monitor** :
   - URL : `https://attestations.fermestandre.com/api/ready`
   - Intervalle : 60 s
   - Alertes : email + webhook (Slack/Discord si utilisé)
3. Tester : arrêter `fsa-app` sur le VPS → l'alerte doit partir en < 2 min.

#### 6.1.2 Alternative : UptimeRobot

1. Créer un compte sur https://uptimerobot.com (plan gratuit : 50 monitors, 5 min d'intervalle).
2. **Add New Monitor** :
   - URL : `https://attestations.fermestandre.com/api/ready`
   - Intervalle : 5 min (minimum en gratuit)
   - Alertes : email, webhook, ou intégration Slack

#### 6.1.3 Pourquoi `/api/ready` et pas `/api/health`

- `/api/health` = liveness (le process répond, sans dépendance) — utile pour le healthcheck Docker.
- `/api/ready` = readiness (la base est joignable) — reflète l'état réel du service pour un
  monitoring externe. Un process qui répond mais dont la base est KO est en panne fonctionnelle.

`TODO(humain) : une fois le monitor créé, copier ici l'URL du dashboard (pas les clés API).`

### 6.2 Cycle « erreur → diagnostic »

```
Erreur en prod
  │
  └─ `handleApiError` (`lib/error-handler.ts`)
       ├─ log `console.error` structuré (`[API ERROR SEV-1]`, route + opération)
       │    └─ logs Docker (`docker compose … logs fsa-app`)
       └─ réponse générique au client (aucun détail en production)
```

**Conditions pour que le cycle fonctionne** :
1. Les erreurs applicatives passent par `handleApiError` — ne jamais renvoyer
   `error.message` brut au client (cf. #321).
2. Un monitor uptime externe (§ 6.1) — les logs ne détectent pas les pannes
   serveur (process mort = personne pour journaliser l'erreur).

**En cas d'alerte** :
1. Lire les logs : `docker compose --env-file .env.production -f compose.prod.yml logs --tail 200 fsa-app`.
2. Si le déploiement est récent → rollback (§ 2.1 ou § 2.2).
3. Sinon → diagnostiquer via les logs (même commande), corriger, déployer.
