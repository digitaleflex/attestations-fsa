# Runbook incidents — FSA Attestations

Objectif : qu'un tiers puisse diagnostiquer et restaurer le service sans connaître le projet.
Procédures de fond (déploiement, rollback, rotation) : [`procedures.md`](procedures.md).
Contacts : [`README.md`](README.md) § Astreinte (⚠️ tableau à compléter — TODO humain).

Tous les exemples de commande s'exécutent **sur le VPS** (sauf mention), dans le répertoire
de l'application `/home/audest/attestations-fsa` (`deploy.yml:36` — ⚠️ voir l'écart de chemin
signalé dans `README.md` § Écarts internes).

---

## 0. Triage — P0 ou P1 ?

| Priorité | Critère (impact utilisateur) | Exemples |
|---|---|---|
| **P0** | Service inaccessible, intégrité des données en cause, ou secret confirmé compromis | Site/vérifieur public down ; VPS injoignable ; perte/corruption DB ; fuite de secret avérée |
| **P1** | Dégradation partielle, le service principal fonctionne | Emails/OTP en panne ; rate-limit en fallback mémoire ; uploads disparus ; latence forte |
| **P2** | Nuisance sans impact fonctionnel immédiat | Observabilité aveugle hors incident ; logs saturés |

**Règle : dans le doute → P0, puis rétrograder une fois le périmètre confirmé.**
Tout incident avec suspicion de fuite de secret passe **P0 par défaut** (voir Incident 3).

## 0 bis. Réflexes communs (quelle que soit la panne)

```bash
# Connexion au VPS — gabarit. Les valeurs sont dans les secrets GitHub
# VPS_HOST / VPS_USER / VPS_PORT (deploy.yml:28-31) ou le .env.production local
# du poste opérateur (deploy-to-vps.sh:34-36). Motif réel : deploy-to-vps.sh:73.
ssh -o ConnectTimeout=10 -p <PORT> <UTILISATEUR>@<HOTE-VPS>

# État des conteneurs (motif : deploy.yml:95)
cd /home/audest/attestations-fsa && \
  docker compose --env-file .env.production -f compose.prod.yml ps

# Journaux applicatifs (motif : deploy-to-vps.sh:261)
docker compose --env-file .env.production -f compose.prod.yml logs --tail=100 fsa-app

# La base répond-elle ? (motif exact : deploy.yml:49-50)
docker exec attestations-fsa-postgres-prod pg_isready -U attestation_fsa_user -d attestation_fsa

# L'app voit-elle la base ? Signal canonique (app/api/ready/route.ts:8-15) :
# 200 = DB joignable ; 503 = DB injoignable depuis l'app. Gabarit :
curl -i https://<DOMAINE-DE-PRODUCTION>/api/ready
# TODO(humain): hostname public réel (hashcode.cloud ? fsa.eurin.tech ? voir README § Écarts)

# Attention : /api/health répond 200 même base morte (app/api/health/route.ts:6-11).
# Un conteneur "healthy" ne prouve RIEN sur la base.
```

Noms réels des conteneurs : app `attestations-fsa-prod`, DB `attestations-fsa-postgres-prod`
(`compose.prod.yml:17,87`).

---

## Incident 1 — Base de données indisponible (P0)

### Symptômes
- `/api/ready` → **503** `{"status":"unready"}` (app/api/ready/route.ts:13).
- Erreurs Prisma dans les logs fsa-app ; pages admin/publices en erreur.
- ⚠️ Le healthcheck de l'app ne sonde que `/api/health`, qui ne touche pas la base
  (`compose.prod.yml:61-69`, `app/api/health/route.ts:6-11`) : fsa-app peut rester
  `Up (healthy)` alors que la base est morte. (Le `depends_on: service_healthy` de
  `compose.prod.yml:54-56` ne joue qu'au **démarrage** : un fsa-app relancé pendant la panne
  DB peut lui rester en `created/restarting`.)
- Traefik peut renvoyer 502 si l'app redémarre en boucle.

### Diagnostic
```bash
docker exec attestations-fsa-postgres-prod pg_isready -U attestation_fsa_user -d attestation_fsa
docker compose --env-file .env.production -f compose.prod.yml logs --tail=100 fsa-postgres
df -h          # volume disque plein ? (volume : attestations-fsa-postgres-prod-data, compose.prod.yml:157)
free -h        # OOM ? (postgres est plafonné à 1 Go, compose.prod.yml:113)
docker inspect -f '{{.State.Status}} {{.State.OOMKilled}}' attestations-fsa-postgres-prod
```

### Action
1. **Disque plein** → libérer de l'espace hors données DB (images dangling :
   `docker image prune`, journaux système). Les logs Docker applicatifs sont déjà bornés
   à 10 Mo × 3 fichiers (`compose.prod.yml:70-74,107-111`).
2. **Conteneur arrêté/OOM** → redémarrer la base seule :
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml restart fsa-postgres
   ```
   Attendre `pg_isready` OK (boucle de la CI : `deploy.yml:48-54`), puis retester `/api/ready`.
3. **Base joignable mais corrompue / données perdues** → NE PAS bricoler. Restaurer une
   sauvegarde : [`procedures.md`](procedures.md) § Restauration. Décision réservée au
   `TODO(humain): décideur restauration` (README § Astreinte) — une restauration fait perdre
   les écritures postérieures au dump.

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ `docker compose down -v` : supprime le volume `attestations-fsa-postgres-prod-data`,
  **seule copie des données** (`compose.prod.yml:153-159`).
- ❌ Lancer `scripts/vps-restore-dump.sh` ou `migrate-to-vps.sh --step=restore` en incident :
  ils font `DROP DATABASE IF EXISTS` (`vps-restore-dump.sh:23`, `migrate-to-vps.sh:226`) et
  visent un PostgreSQL **host**, pas le conteneur Docker de prod. Réservés à la migration
  initiale.
- ❌ Modifier `POSTGRES_PASSWORD` dans `.env.production` en pensant changer le mot de passe
  de la base (voir [`procedures.md`](procedures.md) § Rotation, cas Postgres).
- ❌ Redémarrer postgres « encore une fois » sans logs capturés.

### Escalade
VPS inaccessible ou restauration nécessaire → astreinte N2 infra + décideur
(`TODO(humain): noms/canaux dans README § Astreinte`).

---

## Incident 2 — VPS ou conteneur applicatif down (P0)

### Symptômes
- Site inaccessible : timeout, ou 502/503 renvoyés par Traefik.
- `ssh` vers l'hôte de production (défini par `VPS_HOST`) en échec, OU conteneurs absents de
  `docker compose ps`.

### Diagnostic
```bash
# 1. Hôte joignable ? (gabarit § 0 bis)
ssh -o ConnectTimeout=10 -p <PORT> <UTILISATEUR>@<HOTE-VPS> 'uptime && df -h / && free -h'

# 2. Docker vivant ? Conteneurs sortis ?
systemctl status docker
docker ps -a    # attestations-fsa-prod en "Exited" ? "Restarting" ?

# 3. Pourquoi l'app meurt (motif : deploy-to-vps.sh:261)
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 fsa-app
```
Marqueurs réels à chercher dans les logs :

| Marqueur dans les logs | Signification | Source |
|---|---|---|
| `BETTER_AUTH_SECRET or AUTH_SECRET must be set` | Démarrage impossible en prod : secret d'auth absent du `.env.production` du VPS | `lib/auth.ts:30-34` |
| `RESEND_API_KEY must be set in production` | Envois d'emails en échec (fail-fast) | `lib/email-health.ts:45` |
| `[REDIS INIT ERROR]` | Upstash mal configuré → rate-limit en fallback mémoire | `lib/redis.ts:15` |
| `[RATE LIMIT] Redis indisponible — fallback mémoire` | Protection dégradée (compteurs par-process) | `lib/rate-limit.ts:328-330` |

### Action
1. **Conteneur arrêté, hôte OK** → relancer sans rebuild :
   ```bash
   cd /home/audest/attestations-fsa
   docker compose --env-file .env.production -f compose.prod.yml up -d
   ```
   (motif : `deploy.yml:92`, sans `--build`). Vérifier ensuite § 0 bis.
2. **OOM répété** → l'app est plafonnée à 768 Mo (`compose.prod.yml:76`) : capturer les logs,
   redémarrer, et ouvrir un sujet pour ajuster la limite ou la charge — ne pas supprimer le
   plafond (hôte mutualisé, commentaire `compose.prod.yml:75`).
3. **Hôte injoignable** → console/failover de l'hébergeur
   (`TODO(humain): nom de l'hébergeur, URL de console, qui y a accès`).
   Si le VPS est perdu : reconstruction = [`procedures.md`](procedures.md) § Déploiement
   (premier déploiement via `deploy-to-vps.sh`) + § Restauration (dump `.dump` le plus récent).

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Déclencher un deploy CI sur un disque plein : le `--build` (`deploy.yml:92`) aggrave la
  saturation.
- ❌ Décommenter le `ports:` de postgres (`compose.prod.yml:121-123` : « ne jamais décommenter
  sur VPS public ») pour « tester vite ».
- ❌ Faire un `git checkout` manuel sur le VPS **en silence** : le prochain merge sur `main`
  fera `git pull` par-dessus (`deploy.yml:39`) et masquera l'état observé. Le checkout manuel
  reste LA solution de rollback d'urgence documentée ([`procedures.md`](procedures.md) § 2.2),
  mais il doit être annoncé et converti immédiatement en `git revert` propre (§ 2.1).

### Escalade
Hébergeur injoignable en P0 → `TODO(humain): contact support hébergeur + plan B (nouveau VPS)`.

---

## Incident 3 — Fuite de secret suspectée (P0 par défaut)

### Symptômes
- Un `.env` (ou une clé) a été partagé/vu : capture, issue, log CI, poste volé, départ d'une
  personne ayant accès au VPS.
- `check-env-files.sh` échoue en CI : `Erreur: fichier .env non autorisé détecté`
  (`scripts/check-env-files.sh:38`, workflow `env-guard.yml:12-13`).
- Activité anormale dans `/admin/otp-logs` (cette page affiche les **codes OTP complets**,
  `app/admin/otp-logs/page.tsx:210` — store en mémoire, `lib/otp-store.ts:14-15`).

### Diagnostic
```bash
# Fichiers .env présents dans le dépôt (suivis + non suivis) ?
bash scripts/check-env-files.sh

# traces historiques dans le git log — gabarit (à adapter) :
git log --all --diff-filter=A --name-only --pretty=format: | grep -E '^\.env' || echo "aucun .env ajouté"
```
Vérifier aussi : runs GitHub Actions récents (les secrets GitHub sont masqués, mais un
`echo` accidentuel reste dans les logs du run), et l'accès au VPS
(`last`, `history` de l'utilisateur applicatif — gabarit).

### Action — dans cet ordre
1. **Ne pas attendre la confirmation** : considérer comme compromis tout secret présent sur la
   machine concernée.
2. Rotater **tous** les secrets concernés selon [`procedures.md`](procedures.md) § Rotation :
   `BETTER_AUTH_SECRET`/`AUTH_SECRET`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`,
   `PUSHER_SECRET`/`PUSHER_KEY`, `BOTID_SECRET`, `POSTGRES_PASSWORD`, clés du fournisseur
   d'objets si applicable (voir écart EPIC #148), et `VPS_SSH_KEY` côté GitHub
   (`deploy.yml:28-31`) si l'accès SSH est en cause.
3. Si le VPS lui-même est compromis : considérer la machine comme perdue →
   `TODO(humain): procédure de reconstruction + décideur`.
4. Consigner l'incident (horodatage, secrets tournés, preuves) —
   `TODO(humain): où sont archivés les rapports d'incident ?`

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Supprimer le fichier `.env` de l'arbre de travail et conclure : il reste dans
  l'historique git et dans les backups.
- ❌ Réutiliser une ancienne valeur « le temps de voir ».
- ❌ Coller la valeur d'un secret dans une issue/PR/chantier de chat pour poser une question.
- ❌ Changer `POSTGRES_PASSWORD` dans `.env.production` sans `ALTER USER` dans la base (ou
  l'inverse) : l'app se retrouve verrouillée hors de sa base
  (`DATABASE_URL` construit avec `POSTGRES_PASSWORD`, `compose.prod.yml:33`).

### Escalade
Données personnelles des candidats (noms, emails, notes — cf. tables de `scripts/db-dump.ts`)
⇒ impliquer `TODO(humain): responsable légal/conformité` pour l'éventuelle obligation
de notification.

---

## Incident 4 — Pic de charge (P1 → P0 si indisponibilité)

### Symptômes
- Latence globale, 502/504 via Traefik, erreurs de timeout.
- Logs : `[RATE LIMIT] Redis indisponible — fallback mémoire` (`lib/rate-limit.ts:328-330`)
  ou `Resend send failed` (`lib/email.ts:64`) si le quota amont saute.
- Conteneurs en `Restarting` (OOM : plafonds 768 Mo app / 1 Go DB, `compose.prod.yml:76,113`).

### Diagnostic
```bash
docker stats --no-stream        # app proche de 768m ? db proche de 1g ? pids proches de 512/256 ?
uptime && free -h && df -h      # charge hôte
docker compose --env-file .env.production -f compose.prod.yml logs --tail=100 fsa-app \
  | grep -E "RATE LIMIT|Resend|ECONN"
```
Identifier l'origine : scraping du vérifieur public ? (rate-limit `verify` : 10/h/IP,
`lib/rate-limit.ts:44-46`, utilisé dans `app/api/verifier/route.ts:14`).
`TODO(humain): où sont les logs Traefik et qui les consulte ?` (Traefik tourne sur le réseau
externe `proxy`, `compose.prod.yml:144-148` — sa gestion n'est pas décrite dans le dépôt).

### Action
1. **Rate-limit dégradé (fallback mémoire)** → rétablir Upstash : vérifier
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` présents dans `.env.production` du VPS
   (sans afficher les valeurs) et l'état du compte
   (`TODO(humain): propriétaire du compte Upstash`).
2. **Traffic abusif identifié** → blocage en amont (Traefik/firewall) — exécution :
   `TODO(humain): qui a la main sur Traefik/le pare-feu ?`. Ne pas « solutionner » par
   suppression des limites dans le code.
3. **OOM** → redémarrer l'app seule :
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml restart fsa-app
   ```
   et consigner pour ajuster les limites hors incident.

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Retirer `mem_limit`/`cpus` : hôte mutualisé assumé (`compose.prod.yml:75`).
- ❌ Mettre plusieurs répliques de `fsa-app` « pour absorber » : l'état applicatif est
  **par-process** (store OTP en mémoire `lib/otp-store.ts:14`, fallback mémoire du
  rate-limit) — une mise à l'échelle verticale d'abord, ou un audit préalable du multi-instance.
- ❌ Redémarrer `fsa-postgres` en plein pic sans le décideur : `stop_grace_period: 60s`
  (`compose.prod.yml:117`) = coupure longue.

### Escalade
Indisponibilité > `TODO(humain): seuil de durée à définir` → P0 + décideur.

---

## Incident 5 — Emails / OTP qui ne partent plus (P1)

### Symptômes
- Utilisateurs : « je ne reçois pas mon code » (inscription, connexion OTP
  `app/api/auth/fsa-login/route.ts:202-239`, reset mdp, 2FA admin `lib/auth.ts:126-138`).
- Logs fsa-app : `Resend send failed: ...` (`lib/email.ts:64`) ou
  `RESEND_API_KEY is missing` (`lib/email.ts:14-15`).
- `/admin/otp-logs` montre des envois… mais le code n'arrive jamais.

### Diagnostic
```bash
# 1. La clé est-elle injectée dans le conteneur ? (n'affiche PAS la valeur)
docker exec attestations-fsa-prod sh -c 'test -n "$RESEND_API_KEY" && echo "RESEND_API_KEY: présente" || echo "RESEND_API_KEY: ABSENTE"'

# 2. Erreurs d'envoi dans les logs
docker compose --env-file .env.production -f compose.prod.yml logs --tail=200 fsa-app \
  | grep -E "Resend|RESEND|EMAIL_SERVICE|FSA-LOGIN"

# 3. Les OTP sont-ils générés côté app ? (page admin, store en mémoire,
#    vidé à chaque redémarrage — lib/otp-store.ts:14)
```
Le SDK Resend ne lève pas d'exception sur erreur API : c'est `sendEmail` qui vérifie le
résultat et jette (`lib/email.ts:42-64`) — donc **une erreur en log = échec réel d'envoi**.

### Action
1. Clé absente/mauvaise → la corriger dans `.env.production` du VPS puis recréer `fsa-app`
   ([`procedures.md`](procedures.md) § Rotation).
2. Clé OK mais échecs → compte Resend : quota, domaine d'envoi. Domaine par défaut du code :
   `RESEND_DOMAIN` = `hashcode.cloud` (`lib/email.ts:34-35`, `.env.example:68`) et
   `EMAIL_FROM` (`compose.prod.yml:41`).
   `TODO(humain): quel domaine est réellement vérifié/validé chez Resend ? SPF/DKIM OK ?`
   `TODO(humain): propriétaire du compte Resend + escalade support Resend.`
3. Délais de livraison/spam → vérifier DMARC/Blacklists chez le destinataire ; problème
   DNS → `TODO(humain): administrateur DNS du domaine d'envoi`.

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Communiquer un code OTP à un utilisateur depuis `/admin/otp-logs` par un canal non
  sécurisé : c'est un facteur d'authentification (et la page est visible par tout admin).
- ❌ Désactiver `requireEmailVerification` (`lib/auth.ts:83`) ou le 2FA « pour débloquer ».
- ❌ Redémarrer `fsa-app` avant d'avoir capturé `/admin/otp-logs` et les logs : le store OTP
  est en mémoire et le cycle de logs est court (10 Mo × 3, `compose.prod.yml:70-74`).

### Escalade
Si l'incident dure : la connexion des candidats (OTP email) est **indisponible de fait**
⇒ basculer en P0 et décider une communication aux utilisateurs
(`TODO(humain): canal de communication d'incident`).

---

## Incident 6 — « Stockage » indisponible / fichiers disparus (P1)

**Réalité du checkout actuel : il n'y a PAS de stockage objet.** Les uploads sont écrits sur
le disque du conteneur :
- `/api/upload` → `public/uploads/<cv|images|misc>` (`app/api/upload/route.ts:7,58-65`) ;
- scans d'examens → `private/uploads/scans/<submissionId>`
  (`app/api/admin/submissions/[id]/scans/route.ts:116,222-226`).

`compose.prod.yml` ne monte aucun volume sur `fsa-app` : **ces fichiers vivent dans la couche
éphémère du conteneur et sont détruits à chaque `down`+`up --build`, donc à chaque déploiement**
(`deploy.yml:89-92`, `Dockerfile:72`).

### Symptômes
- 404 sur des URLs `/uploads/...` qui fonctionnaient ; scans « disparus » après un deploy.
- Erreurs `[UPLOAD_ERROR]` (`app/api/upload/route.ts:76`) si le disque est plein ou les
  droits refusés (le conteneur tourne en utilisateur non-root, `Dockerfile:81`).

### Diagnostic
```bash
# Les fichiers existent-ils encore dans le conteneur courant ? (gabarit)
docker exec attestations-fsa-prod sh -c 'ls -la public/uploads 2>/dev/null; ls -la private/uploads 2>/dev/null'
# Disque
df -h
# Date du dernier deploy vs date de disparition (cron/Actions tab)
```

### Action
1. Fichiers disparus après deploy : la seule source de récupération est l'**émetteur**
  (re-upload) — vérifier avant tout discours « récupérable » :
   `TODO(humain): confirmer par exercice qu'aucune sauvegarde de ces fichiers n'existe ailleurs.`
2. Fix de fond (hors runbook) : volume persistant pour `fsa-app` ou stockage objet.
   `TODO(humain): décision + ticket. Si la branche EPIC #148 introduit S3/R2 (cf. README § Écarts),
   documenter ici la bascule une fois mergée.`

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ `docker cp` des fichiers « sauvés » dans le conteneur sans plan : perdus au prochain
  deploy, faux sentiment de restauration.
- ❌ Promettre une récupération de fichiers disparus : dans l'état, ils ne sont nulle part.

### Escalade
Perte de scans d'examen (valeur probante — cf. `docs/data_integrity_audit.md:37`) →
`TODO(humain): responsable pédagogique à prévenir`.

---

## Incident 7 — Vérification publique de certificat en panne (P0 si le vérifieur est down)

Le vérifieur public : page `/verifier` (`app/(public)/verifier/page.tsx`), QR
(`/verifier-qr`), API `GET /api/verifier?code=...` (`app/api/verifier/route.ts`).

### Symptômes
- Le public ne peut plus valider un certificat : erreurs côté page, ou codes HTTP anormaux
  sur `/api/verifier`.

### Diagnostic — interpréter le code HTTP
| Réponse | Cause probable | Vérifier |
|---|---|---|
| 429 | Rate limit légitime : 10 vérifications/h par IP (`lib/rate-limit.ts:44-46`, `app/api/verifier/route.ts:13-19`) ; log `[SECURITY] Rate limit exceeded` (route.ts:17) | IP du plaignant derrière un NAT partagé ? Redis down → fallback mémoire par-process ? |
| 404 | Normal si le code est inconnu **ou** si l'attestation n'est pas `VALIDATED`/`CLAIMED` (`app/api/verifier/route.ts:40-43,67-72`) | Ce n'est pas une panne : état des données |
| 500 | Erreur applicative/DB (`app/api/verifier/route.ts:82-88`) | `/api/ready` → 503 ? → Incident 1 |
| 502/timeout | Conteneur ou hôte down | → Incident 2 |

```bash
# Gabarit — tester l'endpoint depuis l'extérieur :
curl -s -o /dev/null -w "%{http_code}\n" "https://<DOMAINE-DE-PRODUCTION>/api/verifier?code=<CODE-CONNU>"
```
`TODO(humain): code d'attestation de test dédié à la surveillance (jamais un vrai certificat).`

### Action
Selon la cause : Incident 1 (DB), Incident 2 (app), ou Redis (Incident 4). Le cas 429 sur
NAT partagé est un choix produit (anti-scraping, `app/api/verifier/route.ts:3`) : le modifier
nécessite un deploy, pas un hotfix sur le VPS.

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Retirer/assouplir le rate limit « dans l'urgence » : c'est la protection anti-enumeration
  du vérifieur.
- ❌ Passer une attestation en `VALIDATED` en base pour faire « disparaître » un 404 : le
  certificat a une valeur probante (cf. `docs/data_integrity_audit.md:37`) ; tout changement
  de statut relève du métier, pas de l'incident.

### Escalade
Un faux négatif massif (certificats valides rejetés) touche l'image de la FSA →
`TODO(humain): qui communique vers les candidats/employeurs ?`

---

## Incident 8 — Observabilité aveugle (P2, aggravant les autres)

### Réalité vérifiée
- **Pas de Sentry intégré** : aucune dépendance `@sentry/*` dans `package.json`, aucun fichier
  `instrumentation.*` ni `sentry.*` ; les variables `SENTRY_*` de `.env.example:46-50` sont
  **commentées**.
- Pas de monitoring uptime détectable dans le dépôt.
- Historique des logs borné : 10 Mo × 3 fichiers par conteneur (`compose.prod.yml:70-74`).

### Symptômes
- On apprend les pannes par les utilisateurs ; impossible de reconstituer l'historique d'un
  incident passé.

### Diagnostic / Action immédiate
1. **Capturer avant de redémarrer** (le restart purge tout) :
   ```bash
   # Gabarit — figer les journaux hors de l'arbre git (ne pas écrire dans le dépôt) :
   docker compose --env-file .env.production -f compose.prod.yml logs --tail=all fsa-app \
     > /home/audest/incident-$(date +%Y%m%d-%H%M%S)-app.log
   ```
2. Les erreurs applicatives passent par `handleApiError` (`lib/error-handler.ts`, utilisé par
   ex. `app/api/verifier/route.ts:84`) → elles vivent dans les logs Docker, pas dans un SaaS.
3. Marqueurs à grepper (tous réels) : `[RATE LIMIT]`, `[REDIS INIT ERROR]`, `[AUTH]`,
   `[FSA-LOGIN]`, `[UPLOAD_ERROR]`, `[OTP-LOGS]`, `[SECURITY]`, `Resend send failed`.

### Ce qu'il ne faut SURTOUT PAS faire
- ❌ Redémarrer un conteneur « pour voir les logs repartir » sans capture préalable.
- ❌ Ajouter un DSN Sentry « au débotté » sur le VPS sans passer par la procédure de rotation
  (un secret de plus = un secret à gérer).

### Escalade / Dette
`TODO(humain): décider et financer l'observabilité (Sentry ? uptime monitor ?), désigner le
propriétaire, et transformer ce chapitre en runbook d'intégration.`

---

## Post-incident (systématique)

1. Vérifier la chaîne complète : `ps` → `/api/health` → `/api/ready` → `/api/verifier` (code
   de test) → un envoi OTP de test (`TODO(humain): compte de test dédié`).
2. Noter : durée, cause racine, actions, ce qui a manqué au runbook → PR sur `docs/ops/`.
3. `TODO(humain): où consigner les post-mortems ?`
