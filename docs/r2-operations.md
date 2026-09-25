# Exploitation du stockage R2

Ce document couvre les opérations **hors application** du bucket S3-compatible
utilisé par FSA : sauvegarde, restauration, fraîcheur, versioning et alertes.
Aucun identifiant, endpoint réel ou objet applicatif n'est versionné ici.

## Pré-requis

- AWS CLI v2 et `jq` sur la machine d'exploitation.
- Un profil AWS (`R2_PROFILE`, défaut `default`) configuré hors du dépôt.
- `R2_ACCOUNT_ID` + `R2_ENDPOINT` (ou une URL endpoint R2 explicite).
- `R2_BUCKET` : bucket privé de l'application.

Les variables peuvent être injectées par le gestionnaire de secrets ou par un
fichier `600` non versionné. Ne jamais faire apparaître une clé secrète dans
l'historique shell, les logs ou un workflow CI.

## Scripts

| Script | Rôle | Écrit dans le bucket ? |
| --- | --- | --- |
| `scripts/r2-backup.sh` | Exporte le bucket en local + `manifest.json` paginé | non (lecture seule) |
| `scripts/r2-restore.sh` | Restaure un export local vers un bucket | oui, `APPLY=true` requis |
| `scripts/check-r2-backup-freshness.sh` | Alerte si l'export local est absent/ancien | non |
| `scripts/check-r2-versioning.sh` | Alerte si le versioning est désactivé | non |
| `scripts/check-r2-alerts.sh` | Agrège fraîcheur + versioning, émet l'alerte | non |

## Sauvegarde

L'export est local et réversible ; il ne supprime rien du bucket source :

```bash
export R2_BUCKET="bucket-de-production"
export R2_BACKUP_DIR="/home/audest/backups/r2"
export R2_ACCOUNT_ID="<account-id>"
export R2_PREFIX="" # ou, par exemple, "objects/"
DRY_RUN=true ./scripts/r2-backup.sh   # prévisualisation
./scripts/r2-backup.sh                # export réel
```

`r2-backup.sh` utilise `aws s3 sync`, écrit les octets dans
`R2_BACKUP_DIR` puis un `manifest.json` (clé, taille, ETag, date). Le dossier
et le manifeste sont en `700`/`600`. Un export doit être chiffré ou copié sur
un support hors site avant d'être considéré comme une sauvegarde durable.

### Pagination de l'inventaire (`list-objects-v2`)

`aws s3api list-objects-v2` **ne pagine pas tout seul** (contrairement à
`aws s3`) : il renvoie une seule page, plafonnée à 1 000 clés. Un inventaire
construit sur un seul appel est donc **silencieusement tronqué** au-delà de
1 000 objets — une sauvegarde qui « passe » alors qu'elle est incomplète.

`r2-backup.sh` suit donc `NextContinuationToken` jusqu'à la dernière page et
accumule les objets dans un unique tableau JSON :

- le filtre de préfixe est aligné sur la sémantique S3 (`clé == préfixe` ou
  `clé` commençant par `préfixe/`), donc `objects` n'inclut pas `objectsX` ;
- `R2_MAX_PAGES` (défaut `10 000`) borne la boucle : une pagination qui ne
  se termine pas échoue au lieu de produire un manifeste partiel ;
- un jeton de pagination répété fait échouer le script ;
- le journal indique le nombre d'objets et de pages :
  `==> Inventaire paginé : N objet(s) en P page(s)`.

Contrôle après export :

```bash
jq 'length' "$R2_BACKUP_DIR/manifest.json"   # doit correspondre au bucket
```

Pour une sauvegarde planifiée, conserver le répertoire exporté puis vérifier :

```bash
MAX_AGE_HOURS=30 BACKUP_DIR=/home/audest/backups/r2 \
  ./scripts/check-r2-backup-freshness.sh
```

Le contrôle retourne `2` en cas d'absence ou d'ancienneté excessive : à
brancher sur le superviseur/cron pour émettre une alerte.

## Versioning et alerting

```bash
./scripts/check-r2-versioning.sh
```

Le script est en lecture seule et échoue avec le code `2` si le versioning est
désactivé ou illisible. Activer le versioning dans le panneau R2 (ou AWS CLI)
puis rejouer le contrôle. En complément, configurer une règle Lifecycle de
rétention et une alerte fournisseur sur les échecs d'upload, de suppression et
de réplication hors site.

### Point d'entrée unique pour la supervision

`check-r2-alerts.sh` enchaîne les deux contrôles et applique le contrat de
sortie attendu par cron / superviseur :

```bash
MAX_AGE_HOURS=30 BACKUP_DIR=/home/audest/backups/r2 \
R2_BUCKET="bucket-de-production" R2_ACCOUNT_ID="<account-id>" \
  ./scripts/check-r2-alerts.sh
# 0 = tout est OK ; 2 = au moins une alerte ; 1 = erreur d'exécution
```

Si `ALERT_WEBHOOK` est défini, le message d'alerte (jamais de credential) est
également posté en texte brut, en best effort : l'échec d'émission n'est jamais
fatal, le code de sortie reste la source de vérité.

Exemple cron (alerting + sauvegarde) :

```cron
17 3 * * * MAX_AGE_HOURS=30 BACKUP_DIR=/home/audest/backups/r2 R2_BUCKET=bucket-de-production /home/audest/attestations-fsa/scripts/check-r2-alerts.sh
41 2 * * * R2_BUCKET=bucket-de-production R2_BACKUP_DIR=/home/audest/backups/r2 /home/audest/attestations-fsa/scripts/r2-backup.sh
```

## Restauration contrôlée

La restauration est **simulation par défaut**, même avec un export complet :

```bash
export R2_SOURCE_DIR="/home/audest/backups/r2"
export R2_BUCKET="bucket-de-ci-ou-staging"
export R2_ACCOUNT_ID="<account-id>"
export R2_PREFIX=""
./scripts/r2-restore.sh                 # valide le manifeste, simule aws sync
APPLY=true ./scripts/r2-restore.sh      # écrit seulement après validation
```

`r2-restore.sh` vérifie le JSON, la présence de chaque clé et sa taille avant
toute commande d'écriture ; un objet manquant ou une taille incohérente
interrompt la restauration (`exit 1`) en nommant la clé fautive, jamais son
contenu. Ni `manifest.json` ni les marqueurs horodatés
`r2-export-*.manifest.json` ne sont envoyés dans le bucket. Ne jamais restaurer
directement sur le bucket de production sans validation de la version, du
manifeste, des URL signées et des contrôles applicatifs.

## Tests locaux (sans credential, sans données réelles)

Les cinq scripts sont couverts par un banc d'essai bash qui installe un
binaire `aws` factice (un répertoire temporaire fait office de bucket) :

```bash
bash scripts/tests/test-r2-scripts.sh   # ou : pnpm test:r2-scripts
DEBUG_HARNESS=1 bash scripts/tests/test-r2-scripts.sh   # journal des appels aws
KEEP_WORK=1 bash scripts/tests/test-r2-scripts.sh       # conserve le $TMPDIR
```

Ce que le banc prouve, sans aucun accès réseau :

- la pagination `list-objects-v2` parcourt toutes les pages (5 objets, pages de
  2 ⇒ 3 appels) — régression directe sur le manifeste tronqué ;
- le filtre de préfixe n'inclut pas les clés « presque identiques » ;
- la restauration est un dry-run par défaut : sans `APPLY=true`, aucun octet
  n'est écrit, et le manifeste n'est jamais réécrit ;
- un export incomplet (objet absent, taille incohérente) est refusé ;
- fraîcheur / versioning / alerte agrégée renvoient `0` (OK) ou `2` (alerte) ;
- aucun secret n'apparaît dans le journal des appels `aws`.

Le même banc est rejoué par la suite vitest (`tests/scripts/r2-operations.test.ts`,
inclus dans `pnpm test`) et par le job `quality` de la CI.

## Limites explicites

- Les scripts exigent AWS CLI et `jq`; ils ne gèrent pas les URL signées.
- Le bucket reste le juge de paix : un inventaire cohérent ne prouve pas que
  les octets sont lisibles. Après restauration, effectuer un smoke test
  contrôlé d'un objet non nominatif.
- Les scripts ne créent pas de clé, ne modifient pas la lifecycle et ne
  remplacent pas une politique de rétention testée.
- La version applicative du schéma `StoredObject` (propriété, usage, empreinte)
  n'est pas vérifiée par ces scripts : cf. `docs/storage.md`.
