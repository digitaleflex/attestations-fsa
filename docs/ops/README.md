# Opérations — FSA Attestations

Runbooks, procédures et checklists d'exploitation. Issue [#152] (EPIC #148, M8).

> **Ancrage** : chaque commande citée dans ce dossier provient d'un fichier réel du dépôt,
> référencé sous la forme `fichier:ligne`. Ce qui n'existe pas dans le code est marqué
> `TODO(humain)` — jamais inventé.

---

## Par où commencer

| Situation | Aller à |
|---|---|
| **C'est en panne, MAINTENANT** | [`runbook-incident.md`](runbook-incident.md) — triage P0/P1 en tête de document |
| Je dois déployer / redéployer | [`procedures.md`](procedures.md) § Déploiement |
| Le dernier deploy a cassé quelque chose | [`procedures.md`](procedures.md) § Rollback |
| Je dois couper le service (maintenance) | [`procedures.md`](procedures.md) § Maintenance / dégradation |
| Un secret a fuité / doute de fuite | [`runbook-incident.md`](runbook-incident.md) § Incident 3, puis [`procedures.md`](procedures.md) § Rotation de secrets |
| Je prépare une mise en production | [`checklist-mise-en-production.md`](checklist-mise-en-production.md) |
| Je ne sais pas si les backups sont récupérables | [`procedures.md`](procedures.md) § Sauvegarde et restauration + exercice à blanc (TODO non coché) |

---

## Faits d'exploitation à connaître (vérifiés dans le code)

1. **Tout merge sur `main` déploie en production.**
   `.github/workflows/deploy.yml:3-7` : le workflow se déclenche sur `push` vers `main`
   (et `master`) et sur `workflow_dispatch` (déclenchement manuel, entrée `skip_db`).
   Il n'y a **pas** de validation manuelle intermédiaire dans le workflow.
   ⇒ Un merge = un déploiement. La checklist de mise en production se lit **avant** le merge,
   pas après.

2. **Le healthcheck Docker sonde `/api/health`, pas `/api/ready`.**
   `compose.prod.yml:61-69` : `wget --spider http://127.0.0.1:3000/api/health`.
   `/api/health` est un liveness probe sans dépendance (`app/api/health/route.ts:6-11`) :
   il répond 200 même si la base est morte.
   ⇒ Un conteneur « healthy » ne prouve pas que l'app fonctionne. Utiliser `/api/ready`
   (ci-dessous) pour savoir si la base est joignable.

3. **`/api/ready` = sonde base de données.**
   `app/api/ready/route.ts:8-15` : renvoie `200 {status:"ready"}` si `SELECT 1` passe,
   `503 {status:"unready"}` sinon. C'est **le** signal de diagnostic « DB joignable depuis l'app ».
   ⚠️ La version courante de cette route ne teste **que** la base (grep `CERT_SEAL_SECRET` :
   aucun résultat dans ce checkout — voir § Écarts connus).

4. **L'app refuse de démarrer en production sans secret d'authentification.**
   `lib/auth.ts:29-34` : si `BETTER_AUTH_SECRET` (ou `AUTH_SECRET`) est absent avec
   `NODE_ENV=production`, une exception est levée au chargement du module.
   `lib/email-health.ts:41-50` : si `RESEND_API_KEY` est absent en production, l'envoi d'email
   lève une erreur (fail-fast à l'usage, pas au démarrage).

5. **Sauvegarde automatique avant chaque migration.**
   `deploy.yml:56-59` : `scripts/vps-pre-deploy-backup.sh` s'exécute **avant**
   `prisma migrate deploy`, avec `BACKUP_DIR=/home/audest/backups/attestation-fsa`.
   Rétention locale : 10 dumps (`vps-pre-deploy-backup.sh:30`), format custom `pg_dump -Fc`
   (`vps-pre-deploy-backup.sh:48`), checksum sha256 (`vps-pre-deploy-backup.sh:58`).

6. **Chaque déploiement passe par `down` puis `up --build --wait`**
   (`deploy.yml:89-92`) : il y a une **interruption courte à chaque deploy**. Le `--wait`
   bloque tant que le healthcheck `/api/health` ne passe pas.

7. **Les uploads sont écrits sur le disque du conteneur, sans volume persistant.**
   `app/api/upload/route.ts:7` (`public/uploads`) et
   `app/api/admin/submissions/[id]/scans/route.ts:116` (`private/uploads/scans`).
   `compose.prod.yml` ne monte **aucun volume** sur `fsa-app` (seul `fsa-postgres` a
   `fsa-postgres-prod-data`, `compose.prod.yml:93-94,153-159`) et le `Dockerfile` recopie
   `public/` depuis l'étape de build (`Dockerfile:72`).
   ⇒ **Conséquence : un `compose down` + rebuild (donc chaque deploy) détruit les fichiers
   uploadés après le dernier build.** Voir runbook Incident 6. À confirmer par exercice
   (`TODO(humain)`).

8. **Référence de nommage des variables d'environnement : `.env.example`.**
   Les fichiers `.env.*` réels sont git-ignorés (`.gitignore:33-35`) et un workflow
   bloque tout dépôt de `.env` non autorisé (`env-guard.yml` → `scripts/check-env-files.sh`).
   Sur le VPS, la config live est `.env.production` (chargée par `deploy.yml` via
   `--env-file .env.production`, ex. `deploy.yml:45`).

---

## Écarts connus entre l'issue et le code (à trancher par un humain)

L'issue #152 et le brief EPIC #148 mentionnent deux prérequis qui **n'existent pas dans ce
checkout** (branche `issue-152-runbook`, créée depuis `origin/main`) :

| Affirmation du brief | Constat dans le code |
|---|---|
| `/api/ready` renvoie 503 si `CERT_SEAL_SECRET` est absent en production | `app/api/ready/route.ts` ne teste que `SELECT 1`. Grep `CERT_SEAL_SECRET` et `CERT_SEAL` : **0 résultat** dans tout le dépôt. |
| `S3_BUCKET` + clés S3/R2 requis, driver de stockage local refusé en production | Grep `S3_BUCKET`, `S3_` : **0 résultat** de code. Les uploads vont sur disque local (fait 7 ci-dessus). |

`TODO(humain)` : ces deux mécanismes existent-ils dans une branche/PR non mergée (EPIC #148) ?
Si oui, mettre à jour ce document à l'merge et cocher les cases correspondantes de la checklist.
En attendant, ne **pas** les traiter comme des prérequis de déploiement bloquants.

---

## Écarts internes au dépôt repérés à la lecture

- **Deux chemins d'application différents sur le VPS** : la CI déploie dans
  `/home/audest/attestations-fsa` (`deploy.yml:36`), alors que le script local
  `deploy-to-vps.sh` utilise par défaut `/home/audest/attestation-fsa` (singulier,
  `deploy-to-vps.sh:37`, variable `VPS_APP_DIR`). Les deux scripts coexistent donc peut-être
  avec deux répertoires réels sur le VPS.
  `TODO(humain)` : confirmer le répertoire réel (`ls /home/audest/` sur le VPS) et harmoniser.
- **Domaine de production ambigu** : le label Traefik par défaut est `hashcode.cloud`
  (`compose.prod.yml:28`, variable `TRAEFIK_HOST`), alors que `lib/auth.ts:66` liste
  `fsa.eurin.tech` en origine de confiance.
  `TODO(humain)` : quel est le hostname public réel ? Le consigner ici.

---

## Astreinte et contacts

**Aucun contact, numéro, ni horaire d'astreinte n'existe dans le dépôt** (vérifié par lecture
des workflows, scripts et docs). Toute information de ce type dans un runbook doit être vérifiée
par un humain.

`TODO(humain)` — compléter le tableau suivant et le lien d'escalade de chaque incident :

| Rôle | Qui | Comment joindre | Disponibilités |
|---|---|---|---|
| Astreinte N1 (application) | TODO(humain): nom/pseudo | TODO(humain): canal (email ? Slack ? téléphone ?) | TODO(humain): horaires |
| Astreinte N2 (infra/VPS) | TODO(humain) | TODO(humain) | TODO(humain) |
| Responsable GitHub org (secrets, workflows) | TODO(humain) | TODO(humain) | TODO(humain) |
| Contact support VPS (hébergeur) | TODO(humain): lequel ? accès root de secours ? | TODO(humain) | TODO(humain) |
| Propriétaire du compte Resend (email) | TODO(humain) | TODO(humain) | TODO(humain) |
| Propriétaire du compte Upstash (Redis/rate-limit) | TODO(humain) | TODO(humain) | TODO(humain) |
| Propriétaire du domaine + DNS (SPF/DKIM, certs) | TODO(humain) | TODO(humain) | TODO(humain) |
| Décideur « couper le service / restaurer une backup » | TODO(humain) | TODO(humain) | TODO(humain) |

---

(*Issue #152 — EPIC #148 — milestone M8 « Prérequis production »*)
