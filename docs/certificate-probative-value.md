# Valeur probante des attestations — scellement HMAC (#155)

Le scellement garantit l'**intégrité côté serveur** : un enregistrement
d'attestation (code, identité, formation, score, mention, date) est gravé par un
HMAC-SHA256 à l'émission, puis recalculé à la vérification. Toute divergence
entre les données relues et l'empreinte stockée signale une altération.
Ce n'est **pas** une signature légale qualifiée.

Le module de référence est `lib/crypto/seal.ts` ; la logique cryptographique
(`canonicalizeSealPayload`, `computeSealHash`) ne doit pas être modifiée.

## Variables d'environnement

| Variable | Rôle | Secret ? |
| --- | --- | --- |
| `CERT_SEAL_SECRET` | Clé HMAC-SHA256 (≥ 16 caractères). Générer avec `openssl rand -base64 48`. | **Oui** |
| `CERT_SEAL_FINGERPRINT` | Empreinte attendue de la clé, épinglée dans la configuration. | Non |

En production, une clé absente/invalide est un **incident** : l'émission continue
(non bloquante) mais un log `error` est tracé et `GET /api/ready` répond **503**
tant que la clé manque. En dev/test, la clé reste optionnelle et silencieuse.

## L'empreinte : épingler un identifiant, jamais la clé

```
empreinte(secret) = sha256(secret) en hexadécimal, tronqué aux 12 premiers caractères
```

12 caractères hexadécimaux = 48 bits d'un digest SHA-256 : **non réversible** et
insuffisant pour forger un sceau. C'est un identifiant comparable entre
environnements, destiné à être affiché/loggué — ce n'est **pas** un secret.

Épingler `CERT_SEAL_FINGERPRINT` rend la rotation **détectable** :

- l'empreinte réelle est comparée à l'empreinte attendue ;
- `ok` = même clé ; `mismatch` = la clé a changé ; `absent` = aucune clé ;
  `non_epinglee` = `CERT_SEAL_FINGERPRINT` n'est pas définie.

## Procédure de sauvegarde (obligatoire)

1. **`CERT_SEAL_SECRET` ne se rotationne pas.** Elle scelle toutes les
   attestations déjà émises.
2. Conservez la clé **et** son empreinte dans un gestionnaire de mots de passe
   (1Password, Bitwarden, Vaultwarden…), pas seulement dans le `.env` du serveur.
3. Sauvegardez la valeur de `CERT_SEAL_FINGERPRINT` : c'est elle qui permet de
   détecter une dérive à distance, sans avoir accès au secret.
4. **En cas de perte**, aucune vérification des certificats déjà scellés n'est
   possible : c'est irrécupérable.

## Ce qui se passe si la clé est rotationnée

`verifyCertificateSeal` recalcule l'empreinte avec la clé courante. Après
rotation, tous les certificats légitimement scellés avec l'ancienne clé
retournent `valid: false` avec le motif
**« empreinte incohérente : données altérées »** : de parfaits faux positifs de
falsification. Aucun remède rétroactif n'existe sans la clé d'origine.

La rotation est signalée sans bloquer l'émission :

- log `error` à chaque émission si `NODE_ENV=production` ;
- `GET /api/ready` expose la divergence (`sealFingerprintMatch: false`) mais
  reste **200** (bloquer ferait perdre des attestations).

## Diagnostic

**Local, lecture seule, sans jamais afficher la clé :**

```bash
pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seal-key-check.ts
pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seal-key-check.ts --strict
```

Le script compare `.env.local` et `.env.production` (présence, longueur,
empreinte), détecte rotation et divergence, et rappelle la règle de sauvegarde.
`--strict` retourne un code de sortie non nul si absent / rotation / divergence.

**Distant (production) :**

```bash
curl -s https://<domaine>/api/ready | jq .checks
# sealFingerprint         : empreinte réelle de la clé de production
# sealFingerprintExpected : empreinte épinglée
# sealFingerprintMatch    : true | false | null (non épinglée)
```

Comparer `sealFingerprint` entre deux environnements : deux valeurs différentes
prouvent une divergence de clé — un certificat scellé dans l'un n'est pas
vérifiable dans l'autre.
