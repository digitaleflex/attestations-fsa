# Exploitation du stockage R2

Ce document couvre les opérations **hors application** du bucket S3-compatible
utilisé par FSA. Aucun identifiant, endpoint réel ou objet applicatif n'est
versionné ici.

## Pré-requis

- AWS CLI v2 et `jq` sur la machine d'exploitation.
- Un profil AWS (`R2_PROFILE`, défaut `default`) configuré hors du dépôt.
- `R2_ACCOUNT_ID` + `R2_ENDPOINT` (ou une URL endpoint R2 explicite).
- `R2_BUCKET` : bucket privé de l'application.

Les variables peuvent être injectées par le gestionnaire de secrets ou par un
fichier `600` non versionné. Ne jamais faire apparaître une clé secrète dans
l'historique shell, les logs ou un workflow CI.

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
toute commande d'écriture. `manifest.json` n'est jamais envoyé. Ne jamais
restaurer directement sur le bucket de production sans validation de la
version, du manifeste, des URL signées et des contrôles applicatifs.

## Limites explicites

- Le script exige AWS CLI et `jq`; il ne gère pas les URL signées.
- L'inventaire utilise l'API S3 standard : prévoir une vérification de
  pagination/adaptation R2 si le bucket dépasse 1 000 objets.
- Une taille correcte ne remplace pas un test d'ouverture des octets. Après
  restauration, effectuer un smoke test contrôlé d'un objet non nominatif.
- Les scripts ne créent pas de clé, ne modifient pas la lifecycle et ne
  remplacent pas une politique de rétention testée.
