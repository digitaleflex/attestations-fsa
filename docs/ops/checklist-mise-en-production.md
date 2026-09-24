# Checklist de mise en production — FSA Attestations

À parcourir **avant chaque merge sur `main`** — car merge = déploiement immédiat en production
(`.github/workflows/deploy.yml:3-7`, aucun gate manuel dans le workflow).

Les commandes sans préfixe s'exécutent depuis la racine du dépôt, sur le poste de dev.

---

## 1. Code & CI

- [ ] La PR a été relue et les tests CI verts : `Tests` (pnpm audit bloquant niveau high +
      couverture) — `.github/workflows/test.yml:27-32` ; `Env Guard` —
      `.github/workflows/env-guard.yml:8-13`.
- [ ] Vérification locale complète : `pnpm run verify`
      (= `tsc --noEmit && eslint . && vitest run`, `package.json:20`).
- [ ] Aucun test sauté n'a été introduit silencieusement (annoncer tout `.skip`).
- [ ] Version de `package.json` en semver `X.Y.Z` : `bash scripts/check-version.sh`
      (`scripts/check-version.sh:4-9`).
- [ ] Aucun fichier `.env` non autorisé : `bash scripts/check-env-files.sh`
      (seul `.env.example` est permis, `scripts/check-env-files.sh:6-8`).
- [ ] **Aucun secret dans le diff** : noms de variables acceptés, valeurs refusées.

## 2. Migrations Prisma

- [ ] La migration est **additive/réversible en pratique** : `prisma migrate deploy` n'a pas de
      retour arrière automatique (constat `deploy.yml:63`) ; le seul filet est le backup
      pré-deploy (§ 4). Si la migration casse des données → rollback = restauration
      ([`procedures.md`](procedures.md) § 2.3) avec perte d'écritures.
- [ ] La migration a tourné en local (`pnpm run db:migrate`, `package.json:13`) sur une copie
      réaliste des données.
- [ ] Le code déployé est compatible avec l'**ancien** schéma pendant la fenêtre down→up
      (`deploy.yml:89-92`) — ou la coupure est acceptée.

## 3. Environnement de production (VPS `.env.production`)

Présence des variables — **contrôle par nom, jamais par valeur**. Gabarit de contrôle sans
fuite, dans le conteneur après déploiement :
```bash
docker exec attestations-fsa-prod sh -c 'for v in BETTER_AUTH_SECRET AUTH_SECRET RESEND_API_KEY UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN; do if [ -n "$(printenv "$v")" ]; then echo "$v: présente"; else echo "$v: ABSENTE"; fi; done'
```

- [ ] `BETTER_AUTH_SECRET` (ou `AUTH_SECRET`) : **bloquant** — sans lui l'app refuse de démarrer
      en production (`lib/auth.ts:29-34`).
- [ ] `RESEND_API_KEY` : **bloquant pour les emails** — sans elle, tout envoi OTP/reset/2FA
      lève une erreur en prod (`lib/email-health.ts:41-50`) ⇒ connexion des candidats HS
      (flux OTP : `app/api/auth/fsa-login/route.ts:202-239`, `lib/auth.ts:148-192`).
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` : sans eux, rate-limit en fallback
      mémoire par-process (`lib/redis.ts:6-16`, `lib/rate-limit.ts:326-336`) — acceptable
      brièvement, refusé comme état permanent.
- [ ] `POSTGRES_PASSWORD` alignée avec le mot de passe **réel** du rôle dans la base
      (`DATABASE_URL` est construit avec, `compose.prod.yml:33` ; voir le piège de rotation,
      [`procedures.md`](procedures.md) § 4.3).
- [ ] `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` : domaine public correct — les `NEXT_PUBLIC_*`
      sont figés **au build** (`Dockerfile:21-27`) : les changer exige `up -d --build`, pas un
      simple restart.
- [ ] `TRAEFIK_HOST` cohérent avec le domaine réellement servi (défaut du label :
      `hashcode.cloud`, `compose.prod.yml:28`).
      `TODO(humain): hostname public définitif ? fsa.eurin.tech apparaît dans
      lib/auth.ts:66 — lequel est la vérité ?`
- [ ] `PUSHER_*` / `NEXT_PUBLIC_PUSHER_*` : notifications temps réel (défaut cluster `eu`,
      `deploy-to-vps.sh:174-176`).
- [ ] `ADMIN_USER_IDS` : liste des admins (sinon personne n'est promu via ce canal,
      `lib/auth.ts:112-118`).
- [ ] `EMAIL_FROM` / `RESEND_DOMAIN` : domaine d'envoi légitime et validé chez Resend
      (défauts : `FSA <noreply@fermestandre.com>` `compose.prod.yml:41`, `hashcode.cloud`
      `lib/email.ts:34-35`). `TODO(humain): quel domaine d'envoi est réellement vérifié ?`
- [ ] Si la branche EPIC #148 introduit `CERT_SEAL_SECRET` (scellement des certificats) et un
      driver S3/R2 : **à ce jour, aucun de ces mécanismes n'existe dans `origin/main`**
      (grep : 0 résultat ; cf. [`README.md`](README.md) § Écarts connus). Les cocher ici une
      fois mergés, avec leurs vrais fichiers de référence.
      - [ ] `CERT_SEAL_SECRET` présent en prod — ⏸ non applicable sur ce checkout.
      - [ ] `S3_BUCKET` + clés S3/R2 présents — ⏸ non applicable sur ce checkout
            (uploads actuels = disque conteneur éphémère, runbook Incident 6).

## 4. Sauvegardes

- [ ] Le backup pré-deploy de CI est **bloquant** : le deploy échoue si le conteneur DB n'est
      pas là (`vps-pre-deploy-backup.sh:38-41`) ou si le dump sort vide
      (`vps-pre-deploy-backup.sh:51-55`). Vérifier après le deploy :
      ```bash
      ls -lt /home/audest/backups/attestation-fsa | head    # un nouveau .dump à l'horodatage du deploy
      ```
- [ ] Cron de backup quotidien réellement installé sur le VPS :
      `crontab -l` doit montrer le motif documenté (`vps-pre-deploy-backup.sh:9-10`).
      `TODO(humain): confirmer + coller la ligne crontab vérifiée ici.`
- [ ] Offsite : `BACKUP_REMOTE` / `BACKUP_AGE_RECIPIENT` configurés dans
      `~/.config/attestations-fsa/backup.env` (`vps-pre-deploy-backup.sh:18-24`) ?
      `TODO(humain): activé ? destination ? où est la clé PRIVÉE age ?`
- [ ] **Exercice à blanc de restauration réalisé au moins une fois** (critère EPIC : non
      satisfait par ce document).
      `TODO(humain): première restauration testée d'un .dump (gabarit procedures.md § 2.3)
      sur un environnement local via docker-local-setup.sh, datée et consignée ici :
      date ____ / qui ____ / durée ____ / écarts constatés ____.`

## 5. Sécurité

- [ ] `pnpm audit --audit-level=high` passe (bloquant en CI, `test.yml:28-29`).
- [ ] Aucun secret modifié/ajouté sans mise à jour de [`procedures.md`](procedures.md) § 4
      (cartographie des emplacements).
- [ ] Les routes de backup DB restent hors du réseau public : postgres n'est branché que sur
      `backend`, jamais `proxy` (`compose.prod.yml:120-123,143-151`).
- [ ] Durcissement des conteneurs intact : `no-new-privileges` (app et DB,
      `compose.prod.yml:80-81,118-119`) + `cap_drop: ALL` (app seule,
      `compose.prod.yml:82-83`).

## 6. Pendant le déploiement

- [ ] Suivre le run Actions (environment `production`, `deploy.yml:19`).
- [ ] Fenêtre choisie hors pics d'usage (examens ?) —
      `TODO(humain): calendrier des sessions d'examen à ne jamais croiser.`

## 7. Après le déploiement (fumées, < 5 min)

- [ ] `docker compose --env-file .env.production -f compose.prod.yml ps` : tout `Up (healthy)`
      (motif `deploy.yml:95`).
- [ ] `GET /api/health` → 200 (liveness).
- [ ] `GET /api/ready` → 200 (base joignable depuis l'app — `app/api/ready/route.ts:8-15`).
- [ ] `/verifier` : un code connu renvoie le certificat attendu
      (`app/api/verifier/route.ts` ; attention au rate limit 10/h/IP,
      `lib/rate-limit.ts:44-46`).
- [ ] Un email OTP de test part et arrive (`TODO(humain): compte de test dédié`).
- [ ] Logs fsa-app propres sur les 2 premières minutes :
      `docker compose --env-file .env.production -f compose.prod.yml logs --since=2m fsa-app`.
- [ ] Upload de test (image) puis vérification que l'URL répond — **en sachant que ce fichier
      sera détruit au prochain deploy** (runbook Incident 6).

## 8. Bouclage

- [ ] En cas d'incident ou de surprise : mettre à jour le runbook dans la foulée (PR sur
      `docs/ops/`).
- [ ] `TODO(humain): où le déploiement est-il consigné (journal de prod, canal d'équipe) ?`

---

**Validée par :** `TODO(humain): nom + date` · **Contenu testé par :** `TODO(humain): nom + date`
