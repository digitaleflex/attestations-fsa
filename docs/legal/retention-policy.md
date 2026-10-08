# Politique de rétention RGPD (#153)

> **Ancrage** : chaque référence citée provient d'un fichier réel du dépôt
> (`fichier:ligne`). Ce qui n'existe pas est marqué `TODO(humain)`.

## 1. Durées par type de donnée

| Donnée | Durée | Pilote | Effet à échéance |
|---|---|---|---|
| Objets uploadés non probants (`cv`, `internship`, `export`, `temporary`) | 365 j | `StoredObject.retentionUntil`, posée à l'upload (`app/api/upload/route.ts:129`) | Suppression des octets côté stockage + suppression de la ligne (`lib/jobs/retention-purge.ts`) |
| PDF officiels (`purpose = attestation`, préfixe `attestations/`) | Illimitée | `retentionUntil` ignorée | JAMAIS purgés : pièces probantes immuables (`lib/storage/keys.ts:44-46`, `lib/storage/registry.ts:112-115`) |
| Journal d'audit (`AuditLog`) | 365 j | `timestamp` (`AuditLog` ne porte pas de `retentionUntil`) | Suppression des lignes antérieures à la fenêtre (`lib/jobs/retention-purge.ts`) |
| Attestations émises | Illimitée (cycle non destructif) | — | Hors scope de la purge : suppression logique + révocation uniquement (#299/#301, `prisma/schema.prisma:173-196`) |
| Sessions d'examen probantes | Illimitée | — | Hors scope : archivage uniquement (#301, `prisma/schema.prisma:336-342`) |
| Comptes utilisateurs | Jusqu'à demande d'effacement | — | Hors scope de la purge auto : anonymisation traçable (#291, action `ACCOUNT_ANONYMIZED`) |

Chaque passage EFFECTIF de la purge écrit une ligne d'audit unique
(`action = RETENTION_PURGED`, `resource = RETENTION`,
`resourceId = purge-<AAAA-MM-JJ>`, compteurs en `newValue`). Un passage sans
rien à purger n'écrit rien (idempotence observable).

## 2. Planification

La purge est déclenchée par `POST /api/internal/retention/purge`
(`app/api/internal/retention/purge/route.ts`), protégée par
`Authorization: Bearer $CRON_SECRET` (401 sans mutation sinon).

- **Cron système (quotidien, 04:00 UTC)** :
  `0 4 * * * CRON_SECRET=xxx APP_URL=https://<prod> /chemin/vers/attestations-fsa/scripts/cron-retention-purge.sh >> /var/log/fsa-cron-retention.log 2>&1`
  (`scripts/cron-retention-purge.sh`).
- **Docker** : même motif que le service `exam-cron`
  (`compose.prod.yml:181-224`) — `TODO(humain)` : ajouter un service
  `retention-cron` sur le profil `cron` appelant cet endpoint une fois par
  jour, ou étendre le conteneur cron existant.
- **Déclenchement manuel** :
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/internal/retention/purge`.

Volontairement NON rattaché à `.github/workflows/backup-monitor.yml` : ce
workflow surveille la **récupérabilité** (fraîcheur + versioning R2) et la
readiness, pas la rétention — aucun doublon, aucune modification de ce
workflow (lecture seule).
