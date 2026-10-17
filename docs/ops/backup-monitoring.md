# Monitoring des sauvegardes R2 et de la readiness (#295)

> **Ancrage** : chaque commande citée provient d'un fichier réel du dépôt
> (`fichier:ligne`). Ce qui n'existe pas est marqué `TODO(humain)`.

## 1. Owner et fréquence

| Champ | Valeur |
|---|---|
| Owner (rôle, pas une personne) | Responsable sauvegardes — astreinte N2 (infra/VPS) |
| Fréquence | Quotidien, 05:00 UTC (~06:00 Africa/Porto-Novo) |
| Ordonnanceur | `.github/workflows/backup-monitor.yml` (`on: schedule:` cron + `workflow_dispatch` manuel) |
| Canal d'alerte | Issue GitHub label `backup-alert` (créée une fois, commentée ensuite tant qu'elle reste ouverte) |

`TODO(humain)` : créer les secrets GitHub requis par le workflow
(`R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ;
optionnels : `R2_ENDPOINT`, variable `BACKUP_DIR`). Les credentials R2 sont
absents de `.env.production` (aucune section `R2_*`) : ne pas les y ajouter,
ils vivent dans les secrets GitHub (CI) et `~/.config/attestations-fsa/backup.env`
(hôte VPS, cf. `.env.example` § BACKUP).

## 2. Ce que le workflow contrôle

1. `scripts/check-r2-backup-freshness.sh:6-21` — un export local
   `r2-export-*.manifest.json` existe dans `BACKUP_DIR` (défaut
   `/home/audest/backups/attestation-fsa`) et date de moins de `MAX_AGE_HOURS`
   (défaut 30 h). Sortie 2 = alerte.
2. `scripts/check-r2-versioning.sh:6-23` — le versioning du bucket `R2_BUCKET`
   est `Enabled` (via `aws s3api get-bucket-versioning`, profil `R2_PROFILE`,
   endpoint `R2_ENDPOINT` ou `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`).
   Sortie 2 = alerte.
3. `scripts/check-r2-alerts.sh:42-61` — agrège (1) + (2) ; sortie 0 = OK,
   2 = alerte, 1 = erreur d'exécution. `ALERT_WEBHOOK` optionnel (POST best effort).
4. Readiness prod : `curl -f https://attestations.fermestandre.com/api/ready`
   (domaine : `TRAEFIK_HOST` / `NEXT_PUBLIC_APP_URL` de la config prod).
   La route renvoie 200 si `SELECT 1` passe, 503 sinon (`app/api/ready/route.ts`).

## 3. Conduite en cas d'alerte (runbook)

1. **Lire l'issue `backup-alert`** et ouvrir le run en échec
   (`Actions > Backup monitor`) pour identifier l'étape fautive.
2. **Vérifier R2** (depuis une machine avec les credentials) :
   ```bash
   R2_BUCKET=<bucket> bash scripts/check-r2-versioning.sh
   R2_BUCKET=<bucket> bash scripts/check-r2-alerts.sh
   ```
   Si le versioning est désactivé, le script imprime la commande
   `put-bucket-versioning` à appliquer (`scripts/check-r2-versioning.sh:18`).
3. **Vérifier `/api/ready`** :
   ```bash
   curl -f https://attestations.fermestandre.com/api/ready
   ```
   En cas de 503 persistant, basculer sur
   `docs/ops/runbook-incident.md` (triage P0/P1).
4. **Restaurer depuis un export R2** (jamais d'écriture implicite :
   `scripts/r2-restore.sh:42-46`, simulation par défaut) :
   ```bash
   R2_SOURCE_DIR=<export> R2_BUCKET=<bucket> bash scripts/r2-restore.sh   # dry-run
   R2_SOURCE_DIR=<export> R2_BUCKET=<bucket> APPLY=true bash scripts/r2-restore.sh  # après relecture
   ```
   Objets `manifest.json` / `r2-export-*.manifest.json` exclus d'office
   (`scripts/r2-restore.sh:24`).
5. **Vérifier la restaurabilité sur base isolée** (ne restaure rien,
   produit un plan vers `fsa_restore_*`) :
   ```bash
   pnpm exec ts-node --project tsconfig.seed.json scripts/verify-backup-restore.ts \
     --manifest reports/backup-manifest.json \
     --dir /home/audest/backups/attestation-fsa/<date> \
     --host localhost --database fsa_restore_<date> \
     --plan reports/restore-plan.json
   ```
   Procédure complète : `docs/ops/fsa-reference-and-restore.md`
   (export de référence, manifeste, comparaison d'empreintes avant/après).
6. **Clore** : commenter l'issue `backup-alert` (cause + remède) puis la fermer.
   Tant qu'elle reste ouverte, les runs suivants commentent au lieu de
   rouvrir (anti-spam).

## 4. Exercice de restauration — à passer réellement

> Un plan de restauration peut être parfait et le backup inutilisable : dump
> tronqué, index corrompu, données à moitié revenues. Tant que personne n'a
> restauré **pour de vrai**, le filet de sécurité est une hypothèse, pas un
> fait.

```bash
pnpm drill:restore
```

`scripts/restore-drill.sh` monte un PostgreSQL jetable, y crée le **schéma
réel** de l'application, injecte 1 500 lignes de contrôle, fait un `pg_dump`,
restaure réellement, puis **compare table par table** (nombre de lignes ET
empreinte md5 du contenu des utilisateurs). Aucune donnée réelle n'est
requisée et la production n'est jamais touchée.

Le script se termine par un **cas négatif** : il tronque volontairement un
dump et vérifie que `pg_restore` le refuse. Un test de restauration qui ne
sait pas détecter la corruption ne prouve rien.

Durée : ~30 s. À passer **avant toute mise en production**, puis à_INTERVALLE
régulier (recommandation : à chaque changement de schéma, donc à chaque
migration).

Sortie attendue : `EXERCICE COMPLET — restauration fidèle ET corruption
détectée.`

> `scripts/verify-backup-restore.ts` reste le pendant « sans risque » : il
> produit un plan vers une base `fsa_restore_*` et n'exécute rien. L'exercice
> ci-dessus va plus loin mais reste confiné à une base qu'il crée et supprime.

## 5. Uptime externe recommandé

Le workflow GitHub ne remplace pas une sonde externe (fréquence, réseau
indépendant). `TODO(humain)` — créer le compte et le monitor côté humain :

- **Better Stack** (recommandé) ou **UptimeRobot** : monitor HTTPS
  `GET https://attestations.fermestandre.com/api/ready`, intervalle 1–5 min,
  alerte sur 503 / timeout / certificat. Fenêtre : 24/7.
- L'uptime externe surveille la **disponibilité** ; le workflow GitHub
  surveille la **récupérabilité** (fraîcheur + versioning R2). Les deux sont
  complémentaires.
