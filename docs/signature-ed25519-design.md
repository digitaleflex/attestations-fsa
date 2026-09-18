# Conception — Signature numérique Ed25519 des attestations FSA

> **Statut** : proposition d'architecture, en attente de validation humaine (§14).
> **Périmètre** : ajout d'une signature asymétrique **en complément** du scellement HMAC existant (#155/#208/#236/#229). Aucune refonte du pipeline PDF, aucune modification de `canonicalizeSealPayload`.
> **Contrainte structurante** : aucun gros chantier avant que le livrable vertical (#160) soit prouvé en production. Tous les incréments ci-dessous sont ≤ 3 jours d'agent.

---

## 0. Résumé exécutif

| Question | Décision proposée |
|---|---|
| Algorithme | **Ed25519** (RFC 8032, FIPS 186-5), via `node:crypto` natif + `jose` (déjà dans l'arbre via better-auth) |
| Format signé | **JWS compact** (RFC 7515, alg `EdDSA`) sur la **charge canonique existante**, clés publiées en **JWKS** (RFC 7517) |
| Modèle | 4 colonnes additives sur `Attestation` + table `SigningKey` (registre de clés) |
| Stockage clé privée v1 | **Fichier monté 0400** dans le conteneur + escrow triple ; interface `KeyProvider` pour migrer vers KMS plus tard |
| Rotation | `keyId` par certificat + jeu de clés publiques publié → **rotation additive, jamais invalidante** |
| Transport | **QR code** (`URL#JWS`, ≥ 28 mm) + **bloc texte** (empreinte clé, signature, date) ; métadonnées PDF en best-effort |
| Vérification tierce | Page statique épinglant les clés + `/.well-known/fsa/jwks.json` + guide employeur |
| Stéganographie, « algorithmes de secours », 5 mécanismes | **Rejetés** (§10) |
| Premier incrément | Phase 1 : fondation côté serveur + backfill des 40 attestations (§11) |

---

## 1. L'existant — à préserver tel quel

| Élément | Rôle | Statut |
|---|---|---|
| `canonicalizeSealPayload` | Sérialisation canonique (code, nom, formation, score, mention, date de fin) | **Gelée** — la signature porte sur ces octets exacts |
| `sealHash` / `sealedAt` (HMAC-SHA256) | Intégrité côté serveur | **Conservé**, y compris sur les nouveaux certificats (§14-D6) |
| `CERT_SEAL_FINGERPRINT` (#236) | Épinglage de l'empreinte HMAC, détection de rotation | Conservé — devient redondant pour la voie asymétrique (le registre de clés *est* l'épinglage), reste utile à la voie HMAC |
| `revoked` véridique (#229) | Statut de révocation | Orthogonal à la signature : un certificat révoqué **peut** avoir une signature valide (révocation postérieure). Les deux preuves s'affichent séparément |
| Sceller les données canoniques, pas les octets PDF | Décision fondatrice | **Confirmée** — les PDF sont rasterisés côté client (`html2canvas` → JPEG q0.98) : signer les octets casserait à chaque rendu |

**Trois points d'émission** scellent aujourd'hui (`lib/attestations/issue.ts`, `app/api/attestations/route.ts`, `app/api/admin/internships/[id]/attestation/route.ts`). La signature doit les couvrir **tous** — d'où la consolidation proposée en §5.3.

---

## 2. Pourquoi le HMAC seul est insuffisant — confirmation

Les trois faiblesses sont réelles et structurelles :

1. **Symétrie** — la clé qui vérifie est la clé qui forge. Tout opérateur du serveur peut fabriquer un certificat parfait. Aucune non-répudiation : l'organisation ne peut pas prouver qu'un certificat donné émane d'elle *et* un tiers ne peut pas distinguer un vrai certificat d'un faux fabriqué par le serveur.
2. **Dépendance au serveur** — la vérification exige `GET /api/verifier` (rate-limité à 10 requêtes/heure, d'ailleurs) et la confiance dans ce que le serveur répond. Un employeur sans réseau, ou méfiant, ne peut rien vérifier.
3. **Rotation destructrice** — constatée dans le code : `verifyCertificateSeal` recalcule avec la clé **courante**. L'incident vécu (« empreinte incohérente : données altérées » sur des certificats légitimes) est une propriété du mécanisme, pas un bug. L'épinglage #236 rend l'incident *détectable*, pas *impossible*.

La signature asymétrique corrige les trois : la vérification ne nécessite que la clé **publique** (forge impossible sans la privée), elle est faisable hors ligne, et la rotation devient une opération additive.

---

## 3. Choix de l'algorithme

### 3.1 Comparaison chiffrée

| Critère | **Ed25519** | ECDSA P-256 (ES256) | RSA-PSS 2048 (PS256) |
|---|---|---|---|
| Taille signature | **64 o** (86 car. base64url) | 64 o bruts (r‖s), ~71 o en DER | 256 o (342 car. b64url) |
| Taille clé publique | **32 o** | 64 o brutes (~91 o SPKI) | ~270 o (SPKI) |
| Niveau de sécurité | ~128 bits | ~128 bits | ~112 bits (RSA-3072 pour 128 bits → signature 384 o) |
| Déterminisme | **Oui** (RFC 8032, pas de nonce) | Non par défaut (RFC 6979 optionnel) | Oui |
| Mode d'échec caractéristique | — | Réutilisation de nonce → **recouvrement de la clé privée** (précédent réel : Sony PS3, 2010) | — |
| Vitesse (ordre de grandeur, x86 moderne) | sign ~0,05–0,2 ms, verify ~0,1–0,3 ms | sign ~0,2–0,5 ms | sign ~1–15 ms |
| Standardisation | RFC 8032 (2017), **FIPS 186-5** (fév. 2023) | FIPS 186-4, universel | FIPS 186-4, universel |
| `node:crypto` | Natif (≥ Node 12) : `generateKeyPairSync("ed25519")`, `sign(null, data, priv)` | Natif | Natif |
| WebCrypto navigateur | Chrome ≥ 137 (2025), Firefox ≥ 129 (2024), Safari ≥ 17 (2023) | Universel depuis ~2017 | Universel |
| KMS managés | **GCP KMS uniquement** (AWS KMS et Azure Key Vault ne supportent pas Ed25519) | AWS, GCP, Azure | AWS, GCP, Azure |

### 3.2 Recommandation : Ed25519

- **Le budget d'octets est la contrainte dure** : la signature voyage dans un QR code imprimé. 64 o contre 256 o (RSA), c'est une version de QR gagnée — voir les calculs en §7.2.
- **Déterminisme** : pas de dépendance à l'aléa du VPS au moment de signer, et re-signature idempotente (utile pour les retries et le backfill).
- **Écosystème** : natif dans `node:crypto` (zéro dépendance pour la primitive), et `jose` v6.2.3 est **déjà dans l'arbre** (transitif de `better-auth`, vérifié) pour les formats JWS/JWK. Côté navigateur, le vérificateur statique embarquera `@noble/ed25519` (auditée, quelques Ko) pour ne pas dépendre de la disponibilité WebCrypto.
- **Standardisation suffisante** : FIPS 186-5 (2023) l'inscrit dans le corpus fédéral américain ; RFC 8032/8037 le définissent pour JWS/JWK. Ce n'est plus exotique.

### 3.3 Quand un autre choix serait préférable

- **ES256 (ECDSA P-256)** si : (a) l'organisation anticipe un KMS **AWS ou Azure** à court terme (Ed25519 non supporté), ou (b) les vérificateurs tiers visés sont contraints à un outillage FIPS antérieur à 2023. Coût du changement d'avis : faible — le champ `algorithm` par certificat et le registre de clés rendent la migration additive (§5).
- **RSA-PSS** : aucun avantage ici (signatures 4–6× plus grosses, niveau de sécurité inférieur à taille égale). Écarté.
- **Ed448, BLS, Dilithium (post-quantique)** : exotiques pour ce cas. Le post-quantique n'est pas une menace de l'horizon de ce document (§13).

---

## 4. Format du document signé : JWS sur la charge canonique

### 4.1 Décision

La signature porte sur la **sortie exacte de `canonicalizeSealPayload`** — les octets du JSON canonique, pas une nouvelle sérialisation. Le transport est un **JWS compact** (RFC 7515) :

```
base64url(header).base64url(canonicalPayload).base64url(signature)
header = {"alg":"EdDSA","kid":"fsa-k1"}   // littéral figé, ordre des clés fixe → token byte-stable
```

- **jose** pour le format (`CompactSign` / `CompactVerify` / `exportJWK`), **node:crypto** pour la primitive. Pas de crypto maison.
- Le token est **reconstruit à la demande** (header déterministe + charge canonique recalculée depuis la base + signature stockée) : pas de stockage redondant.

### 4.2 Pourquoi JWS plutôt qu'un format maison

| | JWS/JWKS (IETF) | Format maison (JSON + b64 + sig) |
|---|---|---|
| Vérification par un tiers | Toute lib `jose` (JS/TS, Python, Go, Java…) vérifie en 3 lignes | Réimplémentation à spécifier, tester, documenter — source d'erreurs |
| Publication des clés | JWKS (RFC 7517) : format compris par les outils | Idem |
| Crédibilité probante | « standard IETF » se défend devant un employeur ou un tribunal | « format propriétaire » se défend mal |
| Taille | ~5 % d'en-tête en plus | équivalente |

Pour un document à valeur probante, le standard gagne (exigence de qualité du cahier des charges). Le seul coût est une dépendance déjà présente.

### 4.3 Spécification de la forme canonique (pour vérificateurs tiers)

À documenter **byte-exactement** dans le guide employeur, car un vérificateur en Python doit reproduire les mêmes octets quand il re-sérialise depuis la base :

- UTF-8 ; objet JSON à **6 clés dans cet ordre** : `code`, `fullName`, `formationName`, `certificationScore`, `certificationMention`, `endDate` ;
- `null` pour les champs absents ; `endDate` au format `Date.toISOString()` (UTC, millisecondes incluses) ; nombres au format ECMAScript (représentation la plus courte en aller-retour, ex. `87.5`) ;
- **Échappement ECMAScript** (`JSON.stringify` : n'échappe pas les caractères accentués, échappe `"` et `\`).
- **Note d'implémentation** : un vérificateur JWS n'a **pas besoin** de re-sérialiser — la charge utile est dans le token, la signature est vérifiée sur ces octets-là. La re-sérialisation n'intervient que pour la comparaison charge ↔ document imprimé (humaine) ou charge ↔ base (serveur).

---

## 5. Modèle de données

### 5.1 Colonnes additives sur `Attestation` (migration rétro-compatible)

| Colonne | Type | Contenu |
|---|---|---|
| `signature` | `TEXT?` | signature Ed25519 en base64url (86 caractères) |
| `signatureKeyId` | `TEXT?` | identifiant de clé (ex. `fsa-k1`) |
| `signatureAlgorithm` | `TEXT?` | `Ed25519` (dénormalisé : le certificat est auto-descriptif, la migration future ne touche pas les anciens lignes) |
| `signedAt` | `TIMESTAMP(3)?` | date de signature |

Toutes nullables → les 40 attestations existantes restent valides sans action ; les consommateurs actuels de `proof.seal` ne changent pas. Même patron que la migration `20260914120000_attestation_seal` (2 colonnes nullables, zéro champ modifié).

### 5.2 Registre de clés : table `SigningKey`

| Champ | Type | Rôle |
|---|---|---|
| `id` | `TEXT @id` | `fsa-k1`, `fsa-k2`… (lisible, imprimable) |
| `algorithm` | `TEXT` | `Ed25519` |
| `publicKeyJwk` | `JSONB` | JWK OKP standard (`{"kty":"OKP","crv":"Ed25519","x":"…"}`) |
| `fingerprint` | `TEXT` | sha256(clé publique) hex tronqué à 12 — **même convention que #236**, imprimable, comparable à la main |
| `status` | `TEXT` | `active` \| `retired` \| `revoked` |
| `createdAt` / `activatedAt` / `retiredAt` / `revokedAt` | `DateTime?` | cycle de vie auditable |
| `note` | `TEXT?` | contexte humain (« clé initiale 2026-09 », « rotation post-incident ») |

- **Index unique partiel** : un seul `status = 'active'` à la fois.
- La clé **privée n'est jamais en base** (§6).
- Le JWKS public est servi depuis ce registre (§8.2). Alternative écartée : fichier JSON statique dans le dépôt — rotation = déploiement, et le dépôt public ne doit rien savoir des clés ; le registre en base + endpoint est cohérent avec l'existant Prisma. (Décision D7.)

### 5.3 Consolidation des points d'émission

Aujourd'hui `sealCertificate` est appelé en 3 endroits. Demain il faudrait `sealCertificate` + `signCertificate` en 3 endroits — un oubli est probable. **Recommandation** : un module unique `lib/attestations/proofs.ts` exposant `applyProofs(payload)` qui calcule sceau HMAC **et** signature, et retourne les champs à fusionner dans le `create`/`update`. Les 3 points d'appel passent par lui. Réduction du risque « un certificat scellé mais pas signé » à un seul endroit testé.

### 5.4 Backfill des 40 attestations de production

- Script idempotent (`scripts/backfill-signatures.ts`) : signe toute attestation `VALIDATED`/`CLAIMED` sans `signature`, avec la clé active.
- **Honnêteté probante** : `signedAt` = date du backfill (pas la date d'émission). La preuve d'antériorité reste portée par `sealedAt` (HMAC, contemporain de l'émission). Le document doit l'énoncer : la signature rétroactive atteste que *l'organisation aujourd'hui* se porte garante de ces données *scellées à l'époque* — c'est plus faible qu'une signature contemporaine, mais correct et supérieur au statu quo.
- Propriété qui rend le backfill possible : la signature porte sur les **données canoniques**, pas sur des octets de document — elle est **rétrofittable**. C'est un argument d'architecture majeur du choix « signer les données, pas le PDF ».

---

## 6. Gestion des clés — le cœur

### 6.1 Génération (une seule fois, hors serveur)

- **Jamais dans le navigateur, jamais dans le dépôt, jamais sur le VPS.**
- Cérémonie sur le poste administrateur : script `scripts/generate-signing-key.ts` (node:crypto, sortie : JWK publique + empreinte sur stdout, clé privée PKCS#8 vers stdout ou fichier chiffré `age`).
- L'opérateur copie la clé privée dans le gestionnaire de mots de passe, chiffre le fichier, imprime éventuellement. Le VPS ne reçoit que le **fichier final** (§6.2) et la clé **publique** va dans le registre.

### 6.2 Stockage de la clé privée — comparaison concrète

| Option | Coût | Complexité | Exposition résiduelle | Verdict v1 |
|---|---|---|---|---|
| Variable d'environnement (pattern `CERT_SEAL_SECRET` actuel) | 0 € | minimale | `.env` du VPS, `docker inspect`, `/proc/1/environ` — lisible par tout root du VPS | Acceptable (continuité), mais la clé est dans tous les dumps d'env |
| **Fichier monté en lecture seule (0400, uid applicatif)** | 0 € | faible (2 lignes compose) | Filesystem du VPS, root uniquement ; absente de `docker inspect` et de l'environnement process | **Recommandé** |
| KMS managé (GCP KMS pour Ed25519 ; AWS/Azure imposerait ES256) | ~1–3 $/mois + SDK + IAM | moyenne : dépendance réseau **à l'émission** (retry requis), IAM à gérer | Clé **non exportable** ; un serveur compromis ne peut pas voler la clé, seulement faire signer | Différé en v2 — l'interface `KeyProvider` (§6.6) le permet sans refonte |
| HSM / YubiKey (OpenPGP, firmware ≥ 5.2 pour Ed25519) | ~60 € | haute : cérémonie manuelle à chaque lot d'émission — incompatible avec l'émission automatique à la correction d'examen | Physique | Non v1 (§12) |

**Lecture honnête du gain de sécurité v1** : avec la clé dans un fichier du VPS, un **root compromis** peut toujours signer. Ce que la conception apporte dès v1 : la clé n'est **jamais nécessaire à la vérification** (seule la publique l'est), donc la surface qui *lit* la clé privée se réduit au chemin d'émission ; et la rotation devient non destructrice. Le saut suivant (« serveur compromis ≠ forge ») exige KMS/HSM — v2, décision D3.

### 6.3 Rotation SANS invalidation — cycle de vie

```
active   ──rotation──▶ retired ──compromission──▶ revoked
   │  signe les nouveaux certificats
   │  unique (index partiel)
   ▼
retired  : ne signe plus ; clé publique TOUJOURS publiquée ; les signatures existantes vérifient
revoked  : publiée avec statut révoqué ; les vérificateurs signalent « clé révoquée »
```

**Procédure de rotation** (planned, additive) :
1. Générer la nouvelle paire (cérémonie §6.1), insérer dans `SigningKey` (`active`), rétrograder l'ancienne (`retired`).
2. Déployer ; le JWKS expose les deux clés.
3. **Gates de vérification** : un ancien certificat valide toujours (kid ancien) ; un nouveau certificate porte le kid nouveau.
4. Escrow de la nouvelle clé (§6.5). Les clés publiques `retired` ne sont **jamais supprimées**.

**Ce que ça corrige** : l'incident vécu (#155 — rotation HMAC = faux « données altérées » partout) devient structurellement impossible sur la voie asymétrique. La voie HMAC conserve sa règle actuelle : `CERT_SEAL_SECRET` ne se rotationne pas.

### 6.4 Compromission de clé

1. `status = 'revoked'` au registre + publication immédiate (JWKS).
2. Les vérificateurs affichent « signature valide cryptographiquement mais clé révoquée — ne pas faire confiance ».
3. **Re-signature** des certificats légitimes avec la nouvelle clé (rétrofittable, §5.4) — c'est le vrai « algorithme de secours » (§10.2).
4. Seule défense contre les certificats *forgés* avec la clé volée : journal de transparence (§10.2, phase 4 conditionnelle).

### 6.5 Escrow et reprise après perte

| Support | Rôle |
|---|---|
| Gestionnaire de mots de passe (1Password/Bitwarden) | **Primaire** — même règle que `CERT_SEAL_SECRET` (doc existante) |
| Fichier chiffré `age` hors-site | Secondaire — **réutiliser le pattern `BACKUP_AGE_RECIPIENT`** déjà présent dans `.env.example` |
| Copie papier scellée (coffre) | Tertiaire — réaliste pour une ferme |

**Perte sans escrow** : les signatures de ce `keyId` deviennent à jamais invérifiables — **mais** contrairement au HMAC, la rotation est sûre : nouvelle clé, et les certificats signés par l'ancienne restent vérifiables **si** les clés publiques `retired` sont sauvegardées (elles sont publiées : les mettre à l'abri est trivial et doit figurer dans l'escrow).

### 6.6 Interface `KeyProvider`

Le code de signature dépend d'une interface (`getActiveKey(): {privateKey, keyId}`), pas d'un accès direct à l'environnement. v1 : implémentation « fichier monté ». v2 possible : « KMS » sans toucher au métier. Coût : ~20 lignes d'indirection, payées une fois.

---

## 7. Transport de la signature sur le document

### 7.1 Robustesse des supports face à impression / scan / recompression

| Support | Impression | Scan / photo | Recompression numérique | Verdict |
|---|---|---|---|---|
| **QR code** | Conçu pour (redondance Reed-Solomon du QR) | Oui, si taille suffisante | Tolérante (la correction d'erreur du QR absorpe) | **Porteur principal** |
| **Bloc texte** (keyId, empreinte 12 hex, signature 86 car., date) | Oui | OCR possible mais **non garanti** (le PDF produit est une image rasterisée — pas de couche texte) | n/a (papier) | **Repli humain** |
| Métadonnées PDF (dictionnaire Info via `setProperties`, XMP via le plugin `xmp_metadata` de jsPDF) | **Perdues** à l'impression | n/a | Strippées par tout ré-enregistrement | Best-effort numérique uniquement — jamais une preuve |
| URL de vérification (texte imprimé) | Oui | Saisie manuelle | n/a | Chemin en ligne |

### 7.2 Conception du QR — chiffrée

Contenu proposé : `https://<domaine>/verifier#<JWS>`.

- JWS typique : header `{"alg":"EdDSA","kid":"fsa-k1"}` (~32 car. b64url) + charge canonique réelle (~268 car. b64url) + signature (86) ≈ **390–400 caractères** ; avec l'URL ≈ **420–430**.
- Capacité QR (mode octets, correction M) : version 15 ≈ **412 octets**, version 16 ≈ **450**. Version 15 = 77 modules/côté.
- **Taille d'impression** : à 28 mm, modules de 0,36 mm — au-dessus du seuil de scan fiable par téléphone (~0,3 mm recommandé, plus c'est marginal). **Le QR actuel de `CertificateTemplate` fait 35 px ≈ 9 mm, en opacité 50 % et grayscale : à refaire entièrement.**
- **Règle de repli au rendu** : si le token dépasse le budget (noms longs), le QR retombe sur l'URL seule et le bloc texte porte la signature. Seuil documenté, décision automatique, jamais d'échec silencieux.
- **QA obligatoire** (action humaine, phase 2) : impression réelle, scan par 2–3 téléphones, une photocopie, une photo de travers.
- **Le fragment `#` n'est jamais envoyé au serveur** (les fragments restent côté client) : le token n'apparaît pas dans les logs, et la page peut vérifier la signature **localement** avant tout appel réseau.

### 7.3 Bloc texte sous le certificat

Monospace ≥ 7 pt, contraste plein, sur le gabarit imprimé :

```
Signature numérique : Ed25519 · clé fsa-k1 (empreinte 3f9a…c21b)
eyJhbGci6…signature…base64url…86 caractères…
Signé le 2026-09-18 · Vérification : https://<domaine>/verifier
```

Propriété importante : une faute de frappe à la ressaisie **fait échouer** la vérification (fail-closed), jamais réussir. Le bloc texte est le repli quand le QR est dégradé (photocopie, fax).

### 7.4 Refonte UI nécessaire

Trois sites rendent des certificats (`OfficialDocument.tsx` — pas de QR aujourd'hui, `CertificateTemplate.tsx` — QR 35 px, page admin) : **factoriser en un composant partagé** (`VerificationBlock` : QR + bloc texte + empreinte), sinon trois dérives. C'est un changement visible du gabarit → passage par revue de design (règles UI du dépôt).

---

## 8. Vérification

### 8.1 Côté API — forme de la réponse (additive)

`GET /api/verifier?code=…` — les champs existants de `proof` sont conservés (compat frontend), ajout de :

```json
"proof": {
  "algorithm": "HMAC-SHA256", "sealed": true, "valid": true, "…champs actuels…": "…",
  "signature": {
    "present": true, "valid": true, "algorithm": "Ed25519",
    "keyId": "fsa-k1", "keyStatus": "active", "signedAt": "…"
  },
  "jws": "<token complet — le frontend rend QR/texte sans faire de crypto>"
}
```

Le serveur vérifie la signature en **deux temps indépendants** : (1) validité cryptographique contre la clé publique du `keyId` ; (2) cohérence charge canonique ↔ données en base. La révocation (`revoked`, #229) reste un signal **distinct** : signature valide + certificat révoqué = « authentique mais révoqué ».

### 8.2 Hors ligne par un tiers — l'objectif de valeur principal

1. **`/.well-known/fsa/jwks.json`** : JWKS (RFC 7517) avec champs additionnels `status`, `fingerprint`, dates. Récupérable, miroirable, cacheable.
2. **Page de vérification statique** (`/verifier-offline`, aussi distribuable en fichier HTML unique) :
   - **épinglage** du jeu de clés public à la construction (ancre de confiance — la page ne dépend pas du JWKS en ligne pour vérifier) ;
   - `@noble/ed25519` embarqué (auditée, quelques Ko) → indépendante de WebCrypto ;
   - fonctionne en collant le JWS (bloc texte) ou en scannant le QR ;
   - affiche la charge décodée pour comparaison visuelle avec le document imprimé ;
   - **ne contacte jamais le serveur pour la validité cryptographique** ; appelle l'API uniquement pour le statut de révocation (optionnel, signalé comme tel).
3. **Guide employeur** (1 page PDF) : comment vérifier, où trouver les clés, que vaut chaque résultat (valide / clé inconnue / clé révoquée / charge ≠ document).

**Honnêteté sur l'ancre de confiance** : la page épinglée est servie par le même domaine ; un serveur pleinement compromis pourrait en servir une altérée. Parades à coût nul : fichier unique versionné dans le dépôt git (historique = preuve), encouragement au miroir (GitHub Pages, Internet Archive), empreinte de clé imprimée sur chaque certificat pour recoupement. La réponse complète à « le serveur ment sur son histoire » est le journal de transparence (§10.2, phase 4).

### 8.3 Vérification manuelle (sans outil)

À énoncer sans détour : **personne ne vérifie Ed25519 à la main**. Le chemin réaliste pour un humain sans outil :
1. Scanner le QR → page officielle → résultat vert + charge affichée = comparaison visuelle avec le papier.
2. Comparer l'**empreinte 12 hex de la clé** imprimée sur le certificat avec celle affichée par le vérificateur / publiée sur le site — détection d'une clé substituée.
3. En dernier recours : saisir le code sur la page publique (le chemin actuel).

---

## 9. Modèle de menace

| Attaque | Ce que la signature **empêche** | Ce qu'elle **n'empêche pas** | Ce qu'il faudrait en plus |
|---|---|---|---|
| **Forge par serveur compromis** | Rien sur les certificats *existants* (clé publique publiée, vérifiable par tous). Pour les *nouveaux* : rien en v1 si la clé privée est sur le VPS (même exposition que le HMAC) | Un root compromis sur le VPS v1 peut signer de faux certificats | Sortir la clé (KMS, v2) ; journal de transparence (P4) pour *détecter* les certificats absents du registre |
| **Altération du document après émission** | Toute modification des 6 champs canoniques détectée — **en ligne ET hors ligne** (le HMAC ne la détectait qu'en ligne) | Les champs hors charge canonique (birthDate, photo, heures, signature manuscrite) ; l'altération d'un certificat non signé (pré-backfill) | Étendre la charge = v2 (D8) — jamais muter v1 |
| **Rejeu d'un ancien certificat** | Rien par elle-même (la signature est intemporelle) | Un certificat valide à l'époque, révoqué depuis, paraît valide hors ligne | Statut en ligne (existant, #229) ; liste de révocation signée pour le hors ligne (P4) |
| **Vol de clé privée** | — | Forge de **nouveaux** certificats indétectable | Révocation du `keyId` + re-signature (§6.4) ; transparence (P4) pour détecter les forges ; KMS (v2) pour rendre le vol impossible |
| **Faux site de vérification (phishing)** | Le faux site ne peut pas produire de signature valide ni substituer la clé si le vérificateur épinglé est utilisé et l'empreinte recoupée | Un utilisateur qui ignore les signaux, ou un serveur compromis servant de fausses pages aux *nouveaux* visiteurs | Guide employeur, domaine clair, miroirs de la page et des clés |
| **Fraude interne** (l'organisation émet pour un non-candidat) | **Rien** — la signature serait authentique | Tout | Journal append-only + audit externe ; aucune crypto ne remplace la gouvernance |

---

## 10. Les idées du commanditaire — évaluation honnête

### 10.1 Stéganographie → **confirmé : non**

1. **Kerckhoffs** : la sécurité ne doit pas dépendre de la clandestinité du mécanisme. Une marque cachée dont la force repose sur « on ne sait pas qu'elle est là » est fragile par construction.
2. **Destruction physique** : le pipeline actuel rasterise déjà (html2canvas → JPEG), puis impression 300 dpi → scan → OCR → recompression détruisent tout payload de faible redondance. Le « watermark invisible » actuel (`AttestationWatermark` : pixels à opacité 0,01, `data-fp`) ne survit pas à la rasterisation et n'est de toute façon pas récupérable après impression.
3. **Zéro preuve** : son « fingerprint » est un hash 32 bits **non cryptographique** (fonction type djb2), forgeable en millisecondes. Ce n'est pas une preuve, c'est un décor.
4. **Risque juridique** : des caractéristiques cachées dans un document officiel sont difficiles à défendre (l'adversaire dit « marque non divulguée = non opposable ») et nuisent à la crédibilité de l'ensemble du dispositif.
5. Remplaçant supérieur en tous points : QR + bloc texte + empreinte visible (§7).

### 10.2 « Algorithmes de secours » → **confirmé : ça n'existe pas**

Une clé compromise l'est pour **tous** les documents qu'elle a signés ; aucun algorithme alternatif ne « répare » des signatures existantes. Ce qui existe vraiment :

| Mécanisme | Nature | Verdict ici |
|---|---|---|
| **Agilité algorithmique** (`keyId` + champ `algorithm`) | Hygiène : migration future propre sans toucher aux anciennes signatures | **Adopté** (coût nul, déjà dans le modèle) |
| **Révocation + re-signature** | Le vrai secours : la signature signant des données (pas des octets), tout est rétrofittable | **Adopté** (§6.4, §5.4) |
| **Journal de transparence** (append-only, chaîné par hachage, exporté hors serveur) | Le **seul** détecteur de forge par clé volée : un certificat signé mais absent du journal est suspect | **Phase 4, conditionnel** : à 40 certificats et un VPS mono-admin, la menace ne justifie pas 3–5 jours d'agent + une discipline d'export mensuelle. Le devient si multi-admins ou incident |
| **OpenTimestamps** (ancrage Bitcoin, gratuit) | Prouve l'**existence à une date** — utile pour dater une signature avant une compromission | **Phase 4, et seulement pour ancrer la tête du journal mensuelle** (1 opération/mois). Ancrer chaque certificat = sur-engineering |

### 10.3 Double vérification → **tranché : deux, pas cinq**

HMAC (intégrité interne, continuité des 40 certificats existants, mécanisme éprouvé en prod) + Ed25519 (preuve portable, non-répudiation, rotation sûre). Deux mécanismes **indépendants par construction** (clés différentes, familles différentes, chemins de vérification différents). Un troisième n'ajoute aucune menace couverte ; cinq ajoutent de la surface d'attaque, des coûts de maintenance et diluent la responsabilité de chaque preuve. La question « arrête-t-on d'écrire le HMAC sur les nouveaux certificats » est différée à après la phase 3 (D6).

### 10.4 QR code → **oui, suffisant pour « marquer tous les documents », sous conditions**

L'intention « marquer tous nos documents » est satisfaite par : QR (≥ 28 mm, correction M, contraste plein) + bloc texte + empreinte de clé visible. C'est un marquage **vérifiable**, opposable et robuste à l'impression — là où la stéganographie était un marquage invérifiable et fragile. Les conditions non négociables : refonte du QR actuel (35 px, opacité 50 %), composant partagé unique, QA d'impression réelle (§7.2).

---

## 11. Plan par phases

| Phase | Contenu | Valeur apportée | Effort agent | Actions humaines | Risque | Pré-requis |
|---|---|---|---|---|---|---|
| **0** | Merger #208, #236, #229 ; #160 prouvé en prod | Base | 0 j | merge + déploiement | — | — |
| **1** | Fondation serveur : `lib/crypto/signature.ts` + `SigningKey` + `applyProofs` (3 points d'émission) + extension `/api/verifier` + `/api/ready` + backfill 40 | Non-répudiation ; rotation sûre ; signatures rétrofittables ; les deux preuves visibles en API | **2–3 j** | Cérémonie clé + escrow (~1–2 h) ; exécution backfill + contrôle (~30 min) | **Faible** — tout est additif, pattern fail-loud existant réutilisé | P0 |
| **2** | `VerificationBlock` partagé (QR `URL#JWS` + bloc texte + empreinte) sur les 3 gabarits ; métadonnées PDF ; page `/verifier` lit le fragment et vérifie localement | **Le document porte sa preuve** ; vérification sans confiance serveur | **2 j** | QA impression/scan réelle (~2 h) ; revue design | Moyen — UI du certificat visible, QA print impérative | P1 |
| **3** | `/.well-known/fsa/jwks.json` + vérificateur statique autonome + guide employeur | **Vérification tierce hors ligne — l'objectif de valeur principal** | **1–2 j** | Publication + miroir (~1 h) | Faible | P2 |
| **4** (conditionnelle) | Journal append-only chaîné + export mensuel + ancrage OTS de la tête | Détection de forge par clé volée / serveur compromis | **3–5 j** | Export mensuel (~30 min/mois) | Moyen (discipline opérationnelle) | Menace justifiée (multi-admins, incident) |

### 11.1 Premier incrément recommandé — Phase 1, spécification d'exécution

**Objectif** : toute attestation émise ou re-émise porte sceau HMAC **et** signature Ed25519 ; l'API expose les deux preuves ; les 40 attestations existantes sont signées ; aucun changement visible pour l'utilisateur.

**Fichiers touchés (~15)** :

| Fichier | Changement |
|---|---|
| `prisma/schema.prisma` | 4 colonnes `Attestation` + modèle `SigningKey` + index unique partiel |
| `prisma/migrations/<date>_attestation_signature/` | DDL additif (colonnes nullables, table nouvelle) |
| `lib/crypto/signature.ts` **(nouveau)** | `signCanonical(payload, keyProvider)` → `{signature, keyId, algorithm, signedAt}` ; `verifySignature(payload & {signature…}, jwks)` ; header JWS littéral figé ; **importe `canonicalizeSealPayload` — ne le redéfinit pas** |
| `lib/crypto/keys.ts` **(nouveau)** | `KeyProvider` (interface) + implémentation fichier monté (`CERT_SIGN_PRIVATE_KEY_FILE`) + accès registre Prisma |
| `lib/attestations/proofs.ts` **(nouveau)** | `applyProofs(payload)` = sceau HMAC + signature, retour de champs à fusionner |
| `lib/attestations/issue.ts`, `app/api/attestations/route.ts`, `app/api/admin/internships/[id]/attestation/route.ts` | Remplacer l'appel `sealCertificate` par `applyProofs` (3 sites) |
| `app/api/verifier/route.ts` | `proof.signature` + `proof.jws` (additif) |
| `app/api/ready/route.ts` | Sonde : clé de signature présente en prod (503 si absente, même gate que le sceau) |
| `scripts/generate-signing-key.ts` **(nouveau)** | Cérémonie de génération (stdout JWK publique + empreinte ; privée vers stdout/fichier `age`) |
| `scripts/backfill-signatures.ts` **(nouveau)** | Backfill idempotent, log de ce qui est signé, `--dry-run` |
| `.env.example`, `compose.prod.yml` | `CERT_SIGN_PRIVATE_KEY_FILE` (montage 0400), `CERT_SIGN_ACTIVE_FINGERPRINT` (divergence env/registre) |
| `tests/` (~5 fichiers) | Signature/vérification vectorielle, rotation (2 clés, ancienne vérifie), clé absente = dégradé bruyant, backfill idempotent, `verify` gate |
| `docs/signature-ed25519.md` | Doc d'exploitation (cérémonie, escrow, rotation, compromission) |

**Règles d'implémentation** :
- Clé absente en production → **même philosophie que le sceau** : émission non bloquée, log `error`, `/api/ready` 503. La signature est **rétrofittable** (backfill possible après coup) — c'est ce qui autorise le non-blocage.
- Jamais de clé privée : en base, dans `NEXT_PUBLIC_*`, dans une réponse API, dans un log.
- Le token JWS est reconstruit (header déterministe), jamais stocké en colonne.

**Critères d'acceptation** (à faire prouver par le gate `npm run verify` + sondes) :
1. Émission d'une attestation → `sealHash` ET `signature`/`signatureKeyId`/`signedAt` non nuls.
2. `GET /api/verifier` → `proof.seal.valid = true` ET `proof.signature.valid = true` + `jws` vérifiable par `jose` en script autonome.
3. Altération du score en base → les deux preuves échouent.
4. Rotation simulée (2 clés au registre) → certificat signé par `fsa-k1` **valide** alors que `fsa-k2` est active. **C'est le test qui prouve la fin de l'incident #155.**
5. Backfill `--dry-run` → 40 ; exécution → 40 signées ; re-exécution → 0 (idempotence).
6. Prod sans clé de signature → `/api/ready` 503, émission dégradée loggée.

---

## 12. Ce qu'il ne faut PAS faire — sur-engineering et dangers

| Option | Pourquoi non (à cette taille) |
|---|---|
| **KMS en v1** | ~1–3 $/mois + IAM + dépendance réseau à l'émission, pour 40 certificats et un VPS mono-admin. L'interface `KeyProvider` garde la porte ouverte — le faire quand la menace le justifie |
| **HSM / cérémonie YubiKey** | Incompatible avec l'émission automatique à la correction d'examen ; discipline physique qu'une petite structure ne tiendra pas |
| **Journal de transparence maintenant** | 3–5 j d'agent + discipline mensuelle, sans menace actuelle ; le construire « pour être prêt » est la définition du sur-engineering. Phase 4 **conditionnelle** |
| **Ancrage OpenTimestamps par certificat** | 1 opération par certificat pour une preuve que l'ancrage mensuel du journal donne à coût 1/40e |
| **Signature qualifiée eIDAS** | Nécessite dispositif certifié + procédure légale — autre problème (reconnaissance légale), pas cryptographique. À documenter comme voie d'upgrade si un texte l'exige un jour |
| **PKI X.509 interne / chaînes de clés** | Un émetteur unique n'a pas besoin d'une hiérarchie ; JWKS suffit. Les chaînes ajoutent des états d'échec sans menace couverte |
| **Stéganographie** | §10.1 — détruite par le pipeline, zéro preuve, risque juridique |
| **Signer les octets du PDF** | Cassé par définition : le PDF est rasterisé côté client, chaque rendu change les octets |
| **5 mécanismes de preuve** | §10.3 — deux indépendants couvrent les menaces ; plus = surface et confusion |
| **Clé privée en base / `NEXT_PUBLIC` / navigateur** | Interdictions absolues : la base est l'actif le plus exposé ; `NEXT_PUBLIC` finit dans le bundle client |
| **Étendre la charge canonique v1** (`birthDate`, heures…) | Casserait la compatibilité avec les 40 sceaux existants et le gel de `canonicalizeSealPayload`. Si besoin : champ v2 **additif**, jamais une mutation (D8) |
| **Gros chantier avant #160 prouvé** | Contrainte du dépôt : les phases 1–3 sont des incréments verticaux ≤ 3 j, sans nouvelle infrastructure, sans refonte du pipeline PDF |

---

## 13. Ce que cette conception ne protège pas — l'honnêteté obligatoire

1. **La véracité du contenu** : la signature prouve *qui a signé* et *que rien n'a bougé*, pas que le candidat a vraiment réussi. La fraude interne n'est couverte par aucune cryptographie.
2. **La fraude par le serveur en v1** : tant que la clé privée est sur le VPS, un root compromis signe de faux certificats. v1 réduit qui *lit* la clé ; v2 (KMS) la rendrait non exportable.
3. **La révocation hors ligne** : hors réseau, un certificat révoqué paraît valide. La liste de révocation signée est en phase 4 ; d'ici là, le document imprime « révocation vérifiable en ligne ».
4. **Les champs hors charge canonique** : birthDate, photo, signature manuscrite, heures ne sont pas couverts par la preuve (ils le sont par la comparaison visuelle charge ↔ papier).
5. **Un serveur pleinement compromis servant de fausses pages/clés aux nouveaux visiteurs** : les artefacts déjà dans la nature (certificats imprimés, pages miroir, historique git) restent vérifiables ; les nouveaux visiteurs sont exposés jusqu'à reprise de contrôle. Seul le journal externe (P4) répond à « le serveur ment sur son histoire ».
6. **Le post-quantique** : Ed25519, comme P-256 et RSA, tomberait devant un ordinateur quantique cryptographiquement pertinent. Ce n'est pas une menace de l'horizon de ce document ; l'agilité algorithmique (§10.2) est la parade structurelle.

---

## 14. Décisions à valider

| # | Décision | Ma recommandation |
|---|---|---|
| **D1** | Ed25519 (vs ES256 si KMS AWS/Azure ou outillage FIPS rigide anticipé) | **Ed25519** — budget QR, déterminisme, natif Node, `jose` déjà présent |
| **D2** | JWS/JWKS standards (vs format maison) | **JWS/JWKS** — l'interopérabilité tierce est l'objectif de valeur |
| **D3** | Stockage v1 de la clé privée : fichier monté 0400 (vs variable d'env ; KMS différé) | **Fichier monté 0400** + `KeyProvider` pour KMS en v2 |
| **D4** | QR porteur du token : `URL#JWS` avec repli URL-seule (vs QR URL-seule d'emblée) | **`URL#JWS` + repli** — sous réserve de la QA d'impression (phase 2) |
| **D5** | Backfill rétroactif des 40 attestations | **Oui** — `signedAt` honnête (date du backfill), l'antériorité reste portée par `sealedAt` |
| **D6** | Poursuivre l'écriture du HMAC sur les nouveaux certificats | **Oui pour l'instant** (coût ~1 ligne, continuité de format) ; revoir après la phase 3 |
| **D7** | Registre de clés en base + JWKS servi par l'app (vs fichier statique versionné git) | **Base + endpoint** — cohérent avec Prisma et l'émission automatique ; miroir git du JWKS en phase 3 |
| **D8** | Charge canonique : gel v1 (vs extension avant généralisation) | **Gel v1** — documenter la limite ; toute extension = champ v2 additif |
| **D9** | Journal de transparence + OpenTimestamps | **Différer en phase 4 conditionnelle** — pas de menace actuelle à 40 certificats ; déclencheurs : multi-admins, incident de compromission |
| **D10** | Diffusion du vérificateur indépendant | **`/verifier-offline` + fichier HTML unique téléchargeable + miroir (GitHub Pages) + guide employeur PDF** |

---

