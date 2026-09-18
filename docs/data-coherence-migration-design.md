# Conception — Cohérence, intégrité et non-compromission des données à travers sauvegarde, restauration et migration

> **Statut** : proposition d'architecture, en attente de validation humaine (§ « Décisions à valider »).
> **Périmètre** : ce que le système doit à sa propre cohérence — inventaire des données, ensemble cohérent minimal, exigences portées par la base, vérification post-migration, non-compromission des opérations, correctifs de fond, runbook, plan par phases.
> **Hors périmètre** : le parcours produit (#160), la signature Ed25519 elle-même (conçue par `docs/signature-ed25519-design.md`, branche `docs-signature-ed25519` — ce document s'y **articule**, §3.4), le stockage objet lui-même (PR #209 — ce document en prescrit l'**activation**).
> **Contrainte structurante** : aucun gros chantier avant que le livrable vertical #160 soit prouvé en production. Tous les incréments proposés sont ≤ 3 jours d'agent, sans nouvelle infrastructure lourde.

**Conventions de lecture** — chaque fait est marqué :
- ✅ **vérifié** — lu dans le dépôt (référence `fichier:ligne`) ou sur le dépôt GitHub (branches/PR/issues) ;
- 🔍 **déduit** — conséquence logique de faits vérifiés, non observée sur le serveur ;
- ❓ **supposé** — estimation de marché ou élément à confirmer par un humain.

Le working tree local est sur la branche `docs-signature-ed25519` (`.git/HEAD`) : le scellement (#155/#208/#236) n'y est **pas** présent — il vit sur les branches `issue-155-certificate-seal` / `issue-155-protection-sceau`, non mergées dans `main`. Les citations du scellement renvoient à ces branches.

---

## 0. Résumé exécutif

| Question | Décision proposée |
|---|---|
| Qui porte la cohérence ? | **La base** — via une ligne unique `SystemManifest` contenant ses *exigences* (empreinte de clé attendue, clé de signature attendue, plancher de schéma) et un *instantané* (compteurs par entité, résumé du stockage) |
| Comportement au démarrage | **Dégradé bruyant, jamais refus de servir** — même philosophie que le scellement (`lib/crypto/seal.ts`, branche #155 : log `error` + `/api/ready` 503, émission jamais bloquée) |
| Preuve après migration | Manifeste comparé avant/après + endpoint d'auto-diagnostic + CLI ; vérifiable **à distance sans SSH** (pattern #236) |
| Chiffrement des dumps | **Activer le mécanisme age + rclone existant** (`vps-pre-deploy-backup.sh:64-85`, `.env.example:89-95`) — ne rien inventer |
| Fichiers uploadés | **Merger #209 et finir la migration des 2 routes scans** — seul correctif qui rend la classe « fichiers détruits / jamais sauvegardés » *impossible* |
| Nom de dump fixe | **Supprimer l'auto-seed `Backup/deploy-dump.sql`** de la CI (`deploy.yml:80-96`) — ce n'est pas une sauvegarde, c'est un piège à données périmées |
| Compatibilité #237 | Le manifeste porte l'empreinte HMAC **et** l'`id` de clé Ed25519 attendue ; avec la signature, la preuve est auto-portée → une migration n'a **plus besoin de la clé privée** pour que la vérification fonctionne |
| Premier incrément | Phase 1 : manifeste + contrôle au démarrage + sonde `/api/ready` + CLI (≈ 2-3 j d'agent, purement additif, zéro infra) |

---

## 1. Inventaire de l'état — tout ce qui constitue « les données », et où chaque élément vit

### 1.1 Cartographie

| # | Élément | Où il vit (✅ vérifié) | Criticité | Volume | Fréquence de changement | Si perdu ou désynchronisé |
|---|---|---|---|---|---|---|
| 1 | **Base PostgreSQL** (21 modèles : candidats, attestations, examens, sessions, réclamations, registre de clés futur) | Conteneur `fsa-postgres`, volume Docker `fsa-postgres-prod-data` (`compose.prod.yml:101-102,165-167`) | **Critique** — tout le métier | Non mesuré dans le dépôt ❓ (40 attestations d'après `docs/signature-ed25519-design.md` §5.4 ; base petite) | Continu | Perte = perte totale : identités, notes, preuves scellées, comptes |
| 2 | **CV et images** (`public/uploads/<cv\|images\|misc>`) | **Couche d'écriture du conteneur `fsa-app`** — `app/api/upload/route.ts:7` écrit `join(process.cwd(), "public", "uploads")` ; aucun volume sur `fsa-app` (`compose.prod.yml:9-91`), aucun `VOLUME` dans le `Dockerfile` (l. 1-91) | Moyenne (candidatures de stage) | ≤ 5 Mo/fichier (`upload/route.ts:8`) | À chaque candidature | Liens `cvUrl` morts (`schema.prisma:330`) ; candidatures inévaluables |
| 3 | **Scans de compositions** (`private/uploads/scans/<submissionId>/`) | **Couche d'écriture du conteneur `fsa-app`** — `app/api/admin/submissions/[id]/scans/route.ts:116,222` ; même absence de volume | **Critique** — preuve en cas de réclamation (arbitrage #95 : conserver ; l'issue #95 elle-même ne autorise le retrait que « si la correction est dématérialisée », sinon « NE PAS retirer ») | ≤ 5 Mo × ≤ 10 fichiers par upload (`scans/route.ts:25-26`) | À chaque correction d'examen | La ligne `CompositionScan` survit (elle est dans le dump, `db-dump.ts:70`), le fichier 404 à l'ouverture (`[scanId]/route.ts:94-97`) — **preuve affichée mais illisible** |
| 4 | **Secrets d'infrastructure** (`AUTH_SECRET`, `BETTER_AUTH_SECRET`, `POSTGRES_PASSWORD`, `RESEND_API_KEY`, `PUSHER_*`, `UPSTASH_*`, `BOTID_SECRET`) | `.env.production` sur le VPS (`deploy.yml:45` `--env-file`), lui-même `scp`é par la voie manuelle (`deploy-to-vps.sh:140`) ; secrets GitHub `VPS_SSH_KEY` etc. (`deploy.yml:38-41`) | Critique | Quelques centaines d'octets | Rare (rotation) | `AUTH_SECRET` roté → sessions et 2FA chiffrés orphelins (`docs/ops/procedures.md:217`, effet « pas vérifié dans ce dépôt ») ; `POSTGRES_PASSWORD` → verrouillage app↔DB (`procedures.md:222`) |
| 5 | **Clé de scellement HMAC** `CERT_SEAL_SECRET` | `.env.production` (VPS) ; code sur branche `issue-155-certificate-seal` : `lib/crypto/seal.ts` — HMAC-SHA256 sur charge canonique, `verifyCertificateSeal` **recalcule avec la clé courante** | **Critique pour la valeur probante** | 48 octets (`openssl rand -base64 48`, `seal.ts`) | Jamais (règle de non-rotation, PR #236) | Perdue → vérification impossible, irrécupérable ; rotée → **« empreinte incohérente : données altérées » sur des certificats légitimes** (raison littérale dans `verifyCertificateSeal`) |
| 6 | **Empreinte épinglée** `CERT_SEAL_FINGERPRINT` | PR #236 (ouverte, empilée sur #208, cible `issue-155-certificate-seal`) : exposée dans `/api/ready` (`sealFingerprint`, `sealFingerprintExpected`, `sealFingerprintMatch`) + `scripts/seal-key-check.ts` | Haute (détecteur) | 12 hex | Jamais | Sans elle, une rotation est **indétectable** — c'est le quatrième danger listé par la PR #236 |
| 7 | **Clés de signature Ed25519** (futures, #237) | Privée : fichier monté 0400 dans le conteneur (proposition `docs/signature-ed25519-design.md` §6.2, décision D3) ; publique : table `SigningKey` **en base** + JWKS servi par l'app (§5.2, D7) | Critique à l'émission, nulle à la vérification (asymétrique) | 32 o publique / 64 o privée | Rare (rotation additive) | Privée perdue → émission dégradée, **vérification continue** ; publique perdue → signatures à jamais invérifiables (d'où escrow des clés publiques, §6.5) |
| 8 | **Redis Upstash** (rate-limit) | SaaS ; fallback mémoire si absent (`lib/redis.ts:6-16`) | Faible | Compteurs | Continu | Perte = compteurs remis à zéro ; aucune donnée métier |
| 9 | **Pusher / Resend** | SaaS ; notifications **persistées en base** (modèle `Notification`), emails en transit | Faible (données) / moyenne (service) | — | — | Perte du compte = service dégradé, pas de perte de données métier |
| 10 | **Configuration Traefik / compose / CI** | Réseau externe `proxy` (`compose.prod.yml:151-156`), labels (l. 27-33), workflow `deploy.yml` | Haute (disponibilité) | Ko | Par déploiement | Indisponibilité ; deux chemins d'app divergents sur le VPS : `/home/audest/attestations-fsa` (`deploy.yml:50`) vs `/home/audest/attestation-fsa` (`deploy-to-vps.sh:37`) — ✅ `docs/ops/README.md:99-104` |
| 11 | **Sauvegardes** | Dumps `pg_dump -Fc` horodatés + sha256 + chmod 600, rétention 10, dans `/home/audest/backups/attestation-fsa` (`vps-pre-deploy-backup.sh:29-35,48,58-59`) ; offsite chiffré age+rclone **prévu mais optionnel** (l. 64-85, `.env.example:89-95`) ; artefact de seed `Backup/deploy-dump.sql` à **nom fixe** (`deploy.yml:86-89`, `deploy-to-vps.sh:117,136`) | Critique (c'est la seule copie) | Inconnu ❓ | Par déploiement | VPS perdu = **perte totale** tant que l'offsite n'est pas activé ; le seed à nom fixe peut **réinjecter des données périmées** (§2.3) |
| 12 | **Schéma Prisma / migrations** | `prisma/migrations`, appliquées par `prisma migrate deploy` avant chaque démarrage d'app (`deploy.yml:77`, ordre garanti par la CI) | Haute | — | Par déploiement | App > schéma = erreurs runtime ; schéma > app (rollback) = OK si migrations additives (`procedures.md:94-97`) |

### 1.2 Les deux déductions structurantes (🔍 — à confirmer, pas des faits observés)

**D1. Les fichiers uploadés sont détruits à chaque recréation du conteneur.**
Chaîne vérifiée : écriture dans `process.cwd()` (`upload/route.ts:7`, `scans/route.ts:116,222`) + aucun volume sur `fsa-app` (`compose.prod.yml`) + image reconstruite à chaque déploiement (`deploy.yml:111` `up -d --build`). Le `Dockerfile` ne recopie `public/` **qu'au build** (l. 75) — les fichiers écrits après démarrage vivent dans la couche d'écriture, supprimée à la recréation du conteneur. Le runbook existant pose la même déduction et la marque « à confirmer par exercice » (`docs/ops/README.md:63-71`, `runbook-incident.md:313-350`). **Je n'ai pas observé le serveur : c'est une déduction, forte mais à valider par l'exercice #157.**

**D2. (Plus grave, inédit) Les uploads en production échouent probablement déjà avec EACCES.**
Chaîne vérifiée : le `Dockerfile` exécute l'app comme `nextjs` (l. 84 `USER nextjs`), ne `chown` que `/app/.next` (l. 82), et `/app/public` comme `/app` sont détenus par `root` (héritage des `COPY`). 🔍 **Déduction** : `mkdir -p /app/public/uploads/cv` et `mkdir -p /app/private/uploads/scans/...` par l'utilisateur `nextjs` devraient lever `EACCES` → l'upload retournerait 500 (`upload/route.ts:75-81`). Si c'est vrai, le problème n'est pas « les fichiers sont éphémères » mais « **les fichiers ne s'écrivent pas du tout** » — ce qui renforce encore #209. **Action humaine immédiate (D11)** : `docker exec attestations-fsa-prod sh -c 'mkdir -p public/uploads/test 2>&1; mkdir -p private/uploads/test 2>&1'` sur le VPS.

### 1.3 Ce qui n'est sauvegardé nulle part (✅)

`vps-pre-deploy-backup.sh:48` ne fait **que** `pg_dump -Fc`. Le runbook le confirme explicitement : « Ce qui N'EST PAS sauvegardé : les fichiers uploadés (`public/uploads`, `private/uploads/scans`) — pas de volume, pas de script » (`docs/ops/procedures.md:246-247`). Le cron quotidien suggéré par le script (l. 9-10) est un `TODO(humain)` non vérifié installé (`procedures.md:249-252`).

---

## 2. L'ensemble cohérent minimal

### 2.1 La règle

**Définition** — *Une instance FSA est cohérente si et seulement si les cinq propositions suivantes sont vraies :*

| # | Proposition | Ce qui doit voyager ensemble |
|---|---|---|
| C1 | **Schéma** : la dernière migration appliquée ≥ plancher attendu par l'app déployée | base + code |
| C2 | **Scellement** : chaque attestation portant un `sealHash` vérifie contre la clé **attendue par la base** (pas seulement la clé présente) | base + `CERT_SEAL_SECRET` **adéquate** |
| C3 | **Signature** : chaque attestation signée trouve la clé publique de son `keyId` dans le registre `SigningKey` — vérifiable **sans clé privée** | base seule (auto-portée) |
| C4 | **Stockage** : chaque ligne `CompositionScan` référencée correspond à un objet **réellement lisible** | base + fichiers |
| C5 | **Identité** : le manifeste stocké dans la base correspond au manifeste recalculé (au moment du contrôle post-opération) | base ↔ elle-même |

**Ensemble cohérent minimal à transporter lors d'une migration** : ① la base (avec son manifeste et le registre des clés publiques), ② les fichiers (scans + CV), ③ `CERT_SEAL_SECRET` (émission **et** vérification HMAC), ④ les secrets de session (`AUTH_SECRET`/`BETTER_AUTH_SECRET` — sinon comptes orphelins), ⑤ la configuration Traefik/DNS. **Avec #237 déployé, ③ cesse d'être requis pour la vérification** (seule l'émission en dépend) : la preuve devient auto-portée dans la ligne, vérifiable contre la clé publique qui vit **dans la base**. C'est la différence structurelle HMAC/Ed25519 que le commanditaire a demandé d'intégrer : *HMAC = preuve dérivée de la clé (non auto-portée) ; Ed25519 = preuve auto-portée dans la ligne.*

### 2.2 Matrice des migrations partielles — ce qui casse, et comment

| Scénario de migration partielle | Ce qui casse | Type de défaillance |
|---|---|---|
| **Base seule** (sans fichiers) | Scans listés en admin mais 404 à l'ouverture (`[scanId]/route.ts:94-97`) ; CV morts | **Silencieux** — jusqu'au clic, rien n'alerte ; la preuve de réclamation est affichée mais illisible |
| **Base sans clé de scellement** | Vérificateur : « empreinte incohérente : données altérées » sur des certificats **légitimes** | **Bruyant mais mensonger** — le pire : le diagnostic accusé (falsification) masque la vraie cause (clé absente). C'est exactement l'incident vécu |
| **Base + clé, sans empreinte épinglée** | Rotation/divergence indétectable | **Silencieux** — #236 non mergé = pas de détecteur |
| **Fichiers sans base** | Octets orphelins, aucune métadonnée | Silencieux et inutilisable |
| **Base + fichiers, secrets de session rotés** | Sessions invalidées, 2FA chiffrés orphelins (`procedures.md:217`) | Bruyant (utilisateurs déconnectés), effet non testé |
| **Base restaurée + artefact de seed résiduel** | Si le volume DB est un jour perdu, le prochain déploiement **réinjecte automatiquement** `Backup/deploy-dump.sql` — un dump de la base **locale de dev** (`deploy-to-vps.sh:113-118`) — dès que `COUNT(*) FROM "User" = 0` (`deploy.yml:80-96`) | **Silencieux et générateur d'incohérence** — la production repart sur des données périmées sans qu'aucune alarme ne sonne |
| **Deux chemins d'app sur le VPS** | Deux stacks divergentes (`attestations-fsa` vs `attestation-fsa`, §1.1 n° 10) | Silencieux |

**Lecture d'architecte** : le danger n'est pas l'échec bruyant (il se voit, il se corrige), ni même l'échec silencieux pur (il se découvre à l'usage). Le danger est double : ① le **silence structurel** (scans morts, seed résiduel — rien ne les signale tant qu'on ne regarde pas), ② le **bruit mensonger** (le HMAC accusant des données saines). La conception ci-dessous attaque les deux : le manifeste rend le silence impossible (§3), et l'épinglage + le manifeste désambiguïsent le mensonge (« cette base attend la clé d'empreinte X, l'environnement fournit Y » au lieu de « données altérées »).

---

## 3. La base porte ses propres exigences — évaluation et conception

### 3.1 Évaluation de la proposition : **oui, et c'est la bonne idée**

L'incident fondateur (« clé crue perdue, faux « données altérées » ») n'était **pas un bug** : c'est une propriété du mécanisme — la preuve HMAC est dérivée d'une clé qui vit **hors** de la base, donc la base ne peut pas savoir ce qu'elle attend. Enregistrer dans la base *ce dont elle a besoin* inverse la dépendance : la base devient **le porteur de ses exigences**, et toute restauration/migration se contrôle **sans mémoire humaine**. C'est la traduction exacte de la demande du commanditaire (« la cohérence ne doit pas dépendre d'une procédure humaine qu'on oubliera »).

**Ce que ça ne fait pas** : le manifeste ne *répare* rien (une clé perdue reste perdue) — il rend l'incohérence **immédiatement visible et correctement diagnostiquée**. C'est un détecteur structurel, pas un remède.

### 3.2 Forme exacte

**Une table, une ligne** — pas une table par exigence, pas du JSONB intégral :

| Champ | Type | Rôle |
|---|---|---|
| `id` | `String @id` (valeur figée `"manifest"`) | Ligne unique — lecture en une requête, impossible de dupliquer |
| `sealFingerprint` | `String?` | Empreinte 12 hex **attendue** de `CERT_SEAL_SECRET` — même convention que #236 (`sha256(clé)` tronqué, non réversible, imprimable) |
| `sealAlgorithm` | `String` (`"HMAC-SHA256"`) | Auto-descriptif pour un futur changement d'algorithme |
| `signingKeyExpectedId` | `String?` | `keyId` Ed25519 attendu (#237) ; `null` = signature non déployée |
| `schemaBaseline` | `String?` | Dernière migration appliquée au moment de l'écriture (plancher) |
| `appVersionBaseline` | `String?` | Version applicative au moment de l'écriture (`package.json:3` = `3.0.1` aujourd'hui) |
| `snapshot` | `Json?` | Instantané de cohérence : `{ counts: { user, attestation, examSession, compositionScan, … }, storage: { scans: n, bytes: b }, generatedAt, dumpRef }` |
| `snapshotAt` | `DateTime?` | Horodatage de l'instantané |
| `updatedAt` | `DateTime @updatedAt` | |

**Pourquoi une ligne unique et pas JSONB intégral** : les exigences (`sealFingerprint`, `signingKeyExpectedId`) sont comparées **à chaque démarrage** — des colonnes typées rendent la comparaison triviale, indexable et impossible à mal orthographier ; l'instantané change de forme souvent (compteurs) — JSONB l'absorbe sans migration. Deux natures, deux formes, une table.

**Pourquoi PAS un hash global du contenu de la base** : ① coût (hasher 21 tables à chaque contrôle), ② fausses alertes (dérive légitime : `updatedAt`, sessions, notifications), ③ inutile — l'intégrité **par certificat** est déjà portée par le sceau HMAC (`verifyCertificateSeal`), et l'intégrité **par dump** par le sha256 du fichier (`vps-pre-deploy-backup.sh:58`). Le manifeste ajoute ce qui manque : **compteurs** (détection de perte en masse) et **exigences** (détection de désynchronisation base↔environnement). Décision D8.

**Ce qui voyage** : la ligne `SystemManifest` est une table ordinaire → **elle est dans le dump** `pg_dump` et dans le dump JSON (`db-dump.ts` devra l'inclure). Une base restaurée *sait* donc quelle clé elle attend. C'est le mécanisme qui aurait transformé l'incident vécu en diagnostic de 10 secondes.

### 3.3 Le contrôle au démarrage — moment, algorithme, comportement

**Moment** : `instrumentation.ts:10` (`register()`) — le hook Next.js existant, déjà chargé au démarrage serveur (il y initialise Sentry, l. 10-17). C'est le seul point d'entrée garanti avant la première requête, sans toucher aux nœuds critiques interdits.

**Algorithme** (prose, pas code) :
1. Lire la ligne manifeste. Absente → base pré-manifeste : l'initialiser (mode compat), alerte `info`, pas d'échec.
2. **Comparer exigences ↔ environnement** : empreinte calculée depuis `CERT_SEAL_SECRET` vs `sealFingerprint` stocké ; présence du fichier de clé de signature vs `signingKeyExpectedId` ; version schéma appliquée vs `schemaBaseline`.
3. **Comparer l'instantané ↔ recomputation** — *seulement en mode post-opération* (après restauration/migration, déclenché explicitement par le runbook ou par `snapshotAt` très récent). Jamais au démarrage ordinaire : les compteurs dérivent légitimement (nouvelles inscriptions). Coût de la recomputation : 21 `COUNT(*)` sur une base petite — millisecondes aujourd'hui ; à l'échelle, passer aux estimations `pg_stat` (caveat de scalabilité assumé).
4. Agréger : `ok` | `degraded` | `incoherent`, avec détail par contrôle.

**Comportement en cas d'incohérence — l'argument** : la question posée est « refuser de servir, ou servir en mode dégradé avec alerte ? ». **Réponse : jamais refuser de servir.** Trois raisons :
1. **Le pire serait de casser une production qui fonctionne.** Une incohérence détectée à 3 h du matin sur un serveur qui sert correctement des certificats ne doit pas devenir une indisponibilité auto-infligée. Le dépôt a déjà tranché cette philosophie pour le scellement : clé absente → *émission non bloquée*, log `error`, 503 sur `/api/ready` (`lib/crypto/seal.ts` : `reportSealDisabledIfProduction` — « bloquer perdrait des attestations — ce serait pire », PR #236). Le manifeste hérite de cette règle.
2. **Le healthcheck Docker ne regarde pas `/api/ready`** : il sonde `/api/health` (`compose.prod.yml:68-77`), liveness sans dépendance (`app/api/health/route.ts:6-11`). Donc un 503 sur `/api/ready` **alerte sans bloquer le déploiement** — le canal de signal est déjà câblé pour exactement ce comportement.
3. **La granularité du refus est déjà gérée par le métier** : une clé de scellement incohérente fait échouer *la vérification des certificats concernés* (fail-closed au bon endroit), pas le site. Le manifeste ne fait qu'ajouter le *diagnostic juste* à un échec qui existe déjà.

**Effets concrets d'une incohérence** : log `error` structuré (pattern existant), bloc `coherence` dans `/api/ready` (→ 503), capture Sentry si DSN présent (`instrumentation.ts`), bannière admin (phase ultérieure, UI — hors périmètre #160, donc différé).

### 3.4 Articulation avec #237 (Ed25519) — exigée par le commanditaire

| Aspect | Voie HMAC (existant) | Voie Ed25519 (#237) | Ce que le manifeste ajoute |
|---|---|---|---|
| Où vit la preuve | Dérivée de la clé (hors base) | **Dans la ligne** (`signature`, `signatureKeyId`) + clé publique **dans la base** (`SigningKey`, `docs/signature-ed25519-design.md` §5.2) | `signingKeyExpectedId` : la base déclare la clé qu'elle attend |
| Migration de la base seule | Vérification **cassée** sans la clé privée | Vérification **continue** (registre voyage dans le dump) | Détecte « clé d'émission absente » comme *dégradation d'émission*, pas comme corruption |
| Rotation | Destructrice (incident #155) | Additive (§6.3 de #237) | L'épinglage manifeste devient redondant pour Ed25519 (le registre *est* l'épinglage) mais reste requis pour la voie HMAC — cohérent avec #237 §1 |

**Règle de compatibilité à inscrire** : *aucun chemin de vérification ne doit jamais exiger la clé privée* ; le manifeste porte l'identifiant de clé **attendue**, jamais une clé. La clé privée Ed25519 (fichier monté 0400, #237 D3) n'est requise que par le chemin d'émission — une migration qui l'oublie produit une **dégradation bruyante et rétrofittable** (backfill possible, #237 §5.4), pas une corruption.

---

## 4. La vérification après migration — la preuve

### 4.1 Le manifeste comparable avant/après

**Avant l'opération** (sauvegarde ou migration) : rafraîchir `snapshot` (compteurs par entité + résumé stockage) et consigner `dumpRef` (nom du dump + son sha256, déjà produit par `vps-pre-deploy-backup.sh:58`).
**Après** : recalculer et comparer. La comparaison porte sur :

| Dimension | Contenu exact | Ce qu'elle détecte |
|---|---|---|
| Compteurs par entité | `COUNT(*)` des 21 tables (users, attestations, examSessions, compositionScans, reclamations…) | Perte en masse, restauration partielle, seed résiduel (compteurs inattendus) |
| Preuves | nombre d'attestations scellées / signées / vérifiant ; empreinte de clé attendue vs présente | Désynchronisation base↔clé — **le diagnostic que l'incident a révélé manquer** |
| Stockage | nombre de scans référencés vs **réellement lisibles** (stat par fichier aujourd'hui ; `driver.exists()` après #209) ; total d'octets | Liens morts — la classe « base sans fichiers » de §2.2 |
| Schéma | dernière migration appliquée | App/schéma désynchronisés (rollback sans migration) |

**Tolérance de comparaison** : en restauration *à l'identique*, l'égalité doit être **exacte** (le dump est un état figé). En migration avec service arrêté (« freeze »), exacte aussi. Toute différence = échec, pas de seuil de tolérance — c'est une preuve, pas une métrique.

### 4.2 Endpoint d'auto-diagnostic

**Étendre `/api/ready`** (ne pas créer un troisième endpoint public — l'exploitant sans SSH connaît déjà ce canal, pattern #236) :

- `/api/ready` (public, léger) : statut global `ok | degraded | incoherent`, booléens par contrôle (`sealFingerprintMatch`, `signingKeyPresent`, `schemaOk`), empreintes (publiques par nature — #236 l'a déjà décidé). **Pas de compteurs** (fuite d'information inutile). 503 si `incoherent` ou `degraded` — alerte sans blocage (§3.3).
- `/api/admin/coherence` (nouveau, protégé `getAdminUser` — pattern `scans/route.ts:135`) : le rapport complet — compteurs, delta manifeste, scans réellement accessibles, dernier instantané, référence du dernier dump. C'est la version « preuve » pour l'exploitant connecté.

**Vérification sans SSH** (le cas de l'exploitant du commanditaire) : `curl -s https://<domaine>/api/ready` — suffit à confirmer empreinte, clé, schéma ; `curl` authentifié sur `/api/admin/coherence` pour le détail. Exactement l'extension du pouvoir donné par #236 (« le seul moyen de vérifier la clé de production à distance »).

### 4.3 Outil en ligne de commande

`scripts/coherence-check.ts` (lecture seule, même famille que `scripts/check-data-integrity.ts` et le futur `scripts/seal-key-check.ts` de #236) :
- `--snapshot` : rafraîchit l'instantané (à exécuter avant sauvegarde/migration) ;
- `--check` : contrôle complet base↔environnement↔stockage, sortie JSON + code retour non nul si incohérent (branchable en CI) ;
- `--compare <manifeste-avant.json>` : comparaison avant/après pour le runbook de migration ;
- **jamais** de secret en sortie (règle #236 : assertions `not.toContain(secret)` dans les tests).

---

## 5. Non-compromission — protéger les données pendant l'opération

### 5.1 Chiffrement

| Plan | État (✅) | Décision |
|---|---|---|
| **En transit** | `scp`/SSH pour les scripts (`deploy-to-vps.sh:73-74`), TLS Terminé | RAS |
| **Au repos — base** | Volume Docker sur disque VPS, **non chiffré** (aucun mécanisme dans `compose.prod.yml`) | Hors périmètre v1 (chiffrement disque = décision hébergeur, à documenter dans #153) ; le noter honnêtement |
| **Au repos — dumps locaux** | `chmod 600` + répertoire `700` (`vps-pre-deploy-backup.sh:44,59`) | Conserver ; c'est la défense actuelle |
| **Du dump offsite** | **Le mécanisme existe et est éteint** : `age -r "$BACKUP_AGE_RECIPIENT"` + `rclone copy` (`vps-pre-deploy-backup.sh:70-81`), variables documentées (`BACKUP_REMOTE`, `BACKUP_AGE_RECIPIENT`, `.env.example:89-95`), chargées depuis `~/.config/attestations-fsa/backup.env` (l. 18-24) | **Activer tel quel** (D4). Zéro invention : générer une paire age, mettre la publique dans `backup.env`, configurer le remote rclone, provisionner le stockage distant (~5 $/mo pour un bucket S3-compatible ❓). Le script gère déjà le cas « age absent → envoi non chiffré » par un WARN (l. 76) — ce WARN doit devenir un **refus** en production (D4bis) |

**Où vit la clé privée age, qui peut déchiffrer, que se passe-t-il si on la perd ?**
- **Escrow** (même triple que #237 §6.5) : gestionnaire de mots de passe (primaire) + copie papier scellée (secondaire — réaliste pour une ferme). La clé **publique** seule vit sur le VPS.
- Peuvent déchiffrer : les détenteurs de l'escrow. Personne d'autre — y compris le fournisseur du bucket (chiffrement client-side).
- **Si perdue** : l'offsite devient illisible ; la seule copie reste le VPS (qui peut brûler). C'est pourquoi le **test de déchiffrement hors-site** fait partie de l'exercice #157 (§7.4) : un backup offsite jamais déchiffré ne vaut rien — même logique que « un backup jamais restauré ne vaut rien » (#157).

### 5.2 Le nom de fichier fixe — analyse et proposition

Précision factuelle : les **vraies sauvegardes** sont déjà horodatées (`db-backup-$TIMESTAMP.dump`, `vps-pre-deploy-backup.sh:33-35`) avec sha256. Le nom fixe `Backup/deploy-dump.sql` est l'**artefact de seed** : généré depuis un dump JSON de la base **locale** (`deploy-to-vps.sh:113-118`), transféré (l. 136), et **auto-injecté par la CI** si la base de production est vide (`deploy.yml:80-96`). Trois problèmes distincts :
1. **Écrasement concurrent** : deux déploiements rapprochés écrasent l'artefact (la CI est sérialisée depuis #231, `deploy.yml:22-24`, mais la voie manuelle ne l'est pas) ;
2. **Écrasement d'un état valide par un état partiel** : un `scp` interrompu laisse un fichier tronqué qui sera injecté tel quel ;
3. **Le plus grave, structurel** : c'est un **réservoir de données périmées branché en automatique sur la production** — volume DB perdu = le prochain merge réinjecte des données de dev, silencieusement (§2.2).

**Proposition (D3)** : ① supprimer l'étape d'auto-seed de `deploy.yml` (le peuplement initial devient une opération explicite du runbook, avec dump horodaté + sha256 vérifié + comparaison de manifeste) ; ② retirer ou aligner les phases 1-4 de `deploy-to-vps.sh` (elles dupliquent la CI avec des valeurs par défaut dangereuses : `DB_PASSWORD` par défaut, création d'un `.env` avec des secrets neufs si absent — l. 40, 159-185) ; ③ tout artefact de migration porte un nom horodaté + son sha256, référencé dans le manifeste (`dumpRef`).

### 5.3 Suppression de l'ancien serveur après migration

Une migration laisse sur l'ancien hôte : le volume DB (toutes les données personnelles), les dumps locaux (10 générations, `vps-pre-deploy-backup.sh:30`), `.env.production` (tous les secrets), la config rclone. **Articulation #153** (RGPD + APDP Bénin) : une migration **est** un transfert de données personnelles — elle doit figurer au registre des traitements, et l'ancien serveur est un traitement qui doit **s'arrêter proprement** :

1. **Quarantaine 30 jours** (❓ durée à valider) : ancien hôte isolé (firewall/arrêt), **conservé tel quel** — c'est le dernier recours si la migration révèle une perte tardive ;
2. À l'issue : `docker compose down` **puis** `docker volume rm` (le `down` seul ne détruit pas le volume — `procedures.md:176` interdit d'ailleurs le `down -v` accidentel, ici c'est **volontaire et documenté**) ; effacement sécurisé du répertoire de backups et de `.env.production` ; révocation des clés SSH ; suppression de la config rclone locale ;
3. **Honnêteté technique** : sur un VPS (SSD partagé), l'effacement logiciel n'est pas une garantie cryptographique. La réponse honnête : chiffrement disque dès le provisionnement (à documenter dans #153) ou garantie de recyclage de l'hébergeur. Le document ne doit pas promettre un effacement qu'il ne peut pas prouver ;
4. Procédure consignée dans le registre (#153) avec date, périmètre, preuve (sorties de commandes).

### 5.4 Accès aux dumps

Un dump contient des **données personnelles de candidats** : noms, dates et lieux de naissance, téléphones, adresses (`schema.prisma:76-79`), incluses dans le dump JSON (`db-dump.ts:37`) — mots de passe et tokens exclus (l. 42-43, 50-51, 57). Donc :
- **Lecture** : uniquement l'exploitant (propriétaire `600` déjà en place, `vps-pre-deploy-backup.sh:59`) ; jamais de dump sur un support non chiffré, jamais dans le dépôt (déjà gitignoré, `.gitignore:71-72`, et le workflow `env-guard` bloque les `.env` — même discipline à étendre aux dumps) ;
- **Transfert** : SSH (déjà) ou chiffré age **avant** tout autre canal ;
- **Rétention** : locale 10 générations (existant) ; offsite : rétention bornée (proposition : 90 jours ❓, à trancher avec #153 — les dumps chiffrés ne permettent pas l'effacement ciblé d'un candidat, la réponse RGPD est une **durée de rétention courte et documentée**, pas la suppression sélective).

### 5.5 Intégrité d'un dump avant restauration

Le sha256 existe (`vps-pre-deploy-backup.sh:58`) mais **n'est vérifié nulle part** — le gabarit de restauration du runbook le mentionne manuellement (`procedures.md:124-125`). Décision : la vérification devient **une étape obligatoire et automatisée** du futur `scripts/vps-restore-backup.sh` (TODO déjà identifié, `procedures.md:135-136`) : `sha256sum -c` **avant** `pg_restore`, échec = refus de restaurer (fail-closed), puis comparaison de manifeste **après** (§4.1). Un dump altéré doit être détecté **avant** d'écraser des données saines — c'est la seule fenêtre où la détection est encore réversible.

---

## 6. Les correctifs de fond — structurel vs procédural

| Problème (§) | Correctif | Nature | Effet sur la classe de risque |
|---|---|---|---|
| Fichiers détruits à chaque déploiement / jamais sauvegardés (§1.2-D1, §1.3) | **#209 mergé + migration des 2 routes scans** (`lib/storage/migrate.ts` existe déjà dans la PR) + bucket provisionné + sauvegarde du bucket | **Structurel** | Rend la classe **impossible** : les fichiers quittent le conteneur, survivent aux déploiements, se sauvegardent comme la base |
| Incohérence silencieuse base↔clé (§2.2) | Manifeste + contrôle démarrage + `/api/ready` (§3) | **Structurel** | Rend la classe **détectable à chaque démarrage, sans humain** — et *diagnostiquée* (rotation ≠ altération) |
| Preuve non auto-portée (vérification exige la clé privée) (§2.1) | #237 Ed25519 (registre `SigningKey` en base, JWKS) | **Structurel** | Rend la classe **impossible** : la base restaurée vérifie seule |
| Réinjection de données périmées (§5.2) | Suppression de l'auto-seed `deploy-dump.sql` | **Structurel** | Rend la classe **impossible** (plus de réservoir branché) |
| Perte totale si le VPS meurt (§5.1) | Activation age + rclone (mécanisme existant) | **Structurel** | Rend la classe **impossible** (copie hors site chiffrée) |
| Restauration jamais exercée (§7) | Runbook + exercice #157 + test périodique | **Structurel pour la détection** (le test échoue si le chemin est cassé), procédural pour la cadence | Rend la classe **détectable en continu** |
| EACCES éventuel (§1.2-D2) | #209 (le driver S3 n'écrit plus sur le FS local) | **Structurel** | Rend la classe **impossible** ; d'ici là, détection par le contrôle de stockage du manifeste |
| Cron de backup quotidien incertain (§1.3) | Installation + vérification | **Procédural** | Détectable (manifeste : `snapshotAt` trop vieux = alerte) |
| Escrow des clés (age, scellement, signature) | Discipline de conservation | **Procédural** | Non automatisable — mais l'exercice #157 teste l'escrow (échec de déchiffrement = échec d'exercice) |
| Deux chemins d'app divergents (§1.1) | Harmonisation `VPS_APP_DIR` | **Procédural** (une ligne de config) | Pré-requis d'hygiène (D12) |

**Priorisation** (qu'est-ce qui rend une classe *impossible* plutôt que *détectable* ?) : #209 d'abord parmi les correctifs de fond (seul correctif « impossible » pour les fichiers), l'activation offsite ensuite (seul correctif « impossible » pour la perte totale), le manifeste comme socle de détection de tout le reste, #237 en parallèle selon son propre phasage. L'ordre d'implémentation tient compte de la contrainte #160 et des prérequis humains (§8).

---

## 7. Procédure de migration et de restauration — le runbook

### 7.1 Avant (gates bloquants)

| # | Point de contrôle | Critère d'abandon si échec |
|---|---|---|
| A1 | Backup frais : dump `pg_dump -Fc` horodaté + sha256 ; **instantané manifeste rafraîchi** (`--snapshot`) | Pas de backup = pas d'opération |
| A2 | Vérification du sha256 du dump retenu | Mismatch = dump corrompu, **arrêt** |
| A3 | Fichiers : sauvegarde du stockage (post-#209 : bucket ; avant #209 : constat explicite que les fichiers ne sont pas transportables — l'opération doit le **savoir et l'accepter par écrit**) | Refus implicite : avant #209, toute migration est une migration **partielle assumée** |
| A4 | Cible : secrets en place, **empreinte de scellement identique** (`scripts/seal-key-check.ts` #236 des deux côtés), DNS/traefik prêts | Empreinte divergente sans rotation documentée = **arrêt** |
| A5 | Offsite joignable (rclone) + **test de déchiffrement age sur le dernier backup** | Échec = l'escrow est cassé, **arrêt** (on ne migre pas si le filet est troué) |
| A6 | Annonce + fenêtre (candidats prévenus si coupure) | — |

### 7.2 Pendant

1. **Freeze des écritures** (arrêt `fsa-app` — `procedures.md:161-167` fournit le gabarit ; la base reste disponible pour le dump final) ;
2. Dump final + sha256 + snapshot manifeste final ;
3. Transfert chiffré (SSH ou age) ; vérification sha256 **à l'arrivée** ;
4. Restauration sur la cible : `pg_restore` (ou `psql` selon format) **dans un volume neuf** — jamais dans le volume en service ;
5. Migrations de schéma : `prisma migrate deploy` (uniquement **en avant** ; une migration destructive = arrêt et revue humaine) ;
6. Fichiers : restauration du bucket / transfert explicite ;
7. Démarrage : le contrôle de cohérence (§3.3) s'exécute ; **comparaison manifeste avant/après** (`--compare`) : égalité exacte exigée ;
8. Fumées : `/api/health`, `/api/ready` (bloc `coherence`), `/verifier` avec un code connu, ouverture d'un scan connu, connexion admin.

### 7.3 Critères d'abandon en cours d'opération

- sha256 invalide à l'arrivée (§7.2-3) ;
- `pg_restore` en erreur autre que « objet existe déjà » bénin ;
- comparaison de manifeste : **tout** écart (compteur, scans accessibles, empreinte) ;
- migration Prisma non additive ;
- healthcheck ou fumées en échec après 3 tentatives.

**Retour arrière** : la restauration se fait toujours **dans un volume neuf** (§7.2-4) — l'ancien volume reste intact jusqu'à validation ; le rollback est un échange de noms de volume + redémarrage, minutes. La règle d'or : **on ne détruit jamais l'état de production avant que la cible ne soit validée**. (C'est la leçon déjà inscrite dans la CI pour l'app : « aucun `down` préalable », `deploy.yml:101-109` — même principe appliqué aux données.)

### 7.4 Après

- Manifeste mis à jour sur la cible ; backups rebranchés (cron + offsite) **vers la cible** ;
- Ancien serveur : quarantaine puis effacement (§5.3) ;
- **RTO/RPO mesurés et consignés** (durée du freeze → service rendu ; pertes de données acceptées) ;
- Rétrospective : ce qui a coincé alimente le runbook.

### 7.5 Rendre #157 réel — l'exercice sur cible jetable

L'issue #157 (M8, P0 bloquant production) exige : restauration complète **DB + fichiers**, RTO/RPO mesurés, test périodique automatisé, intégrité post-restauration. Concrètement :
1. **Cible jetable** : conteneur local (`scripts/docker-local-setup.sh` et sa chaîne existante, `procedures.md:264-272`) ou droplet éphémère — jamais la production ;
2. **Scénario complet** : récupération du dernier backup **offsite chiffré** (pas le local — sinon on ne teste pas l'escrow), `age -d`, `sha256sum -c`, `pg_restore`, migrations, démarrage, comparaison de manifeste, fumées ;
3. **Critères de succès mesurables** : RTO constaté (proposition de cible : ≤ 30 min ❓ — c'est un objectif à **mesurer**, pas une promesse), RPO = horodatage du dump utilisé, égalité exacte du manifeste, 100 % des scans accessibles (post-#209) ;
4. **Périodicité** : premier exercice daté et consigné (le `TODO(humain)` de `procedures.md:272` est alors décoché), puis répétition trimestrielle manuelle ; le test de restauration **automatisé en CI** (mensuel, base vide + dump de fixture) est un incrément séparé — il ne teste pas l'offsite mais le chemin `pg_restore` + manifeste.

---

## 8. Plan par phases

Contrainte respectée : chaque phase ≤ 3 j d'agent, aucune ne touche au parcours produit (#160), toutes additives. Les actions humaines sont explicites.

| Phase | Contenu | Valeur | Effort agent | Effort humain | Risque | Pré-requis |
|---|---|---|---|---|---|---|
| **P0** — hygiène (0 j agent) | Vérifier la déduction EACCES (D11) ; installer/vérifier le cron de backup (TODO `procedures.md:249-252`) ; harmoniser les deux chemins d'app (D12) ; trancher D1-D12 | Retire les angles morts *avant* d'automatiser | 0 | ~1-2 h sur le VPS | Nul | Décisions |
| **1** — **Manifeste** | Table `SystemManifest` + migration additive ; contrôle au démarrage (`instrumentation.ts`) ; bloc `coherence` dans `/api/ready` ; `/api/admin/coherence` ; `scripts/coherence-check.ts` ; tests (dont `not.toContain(secret)`) | **Le silence devient impossible** : toute désynchronisation base↔clé↔schéma est visible au prochain démarrage et à distance ; fondation de toutes les phases suivantes | **2-3 j** | Revue (~1 h) | **Faible** — purement additif, pattern fail-loud existant | P0, D1/D2/D8 |
| **2** — Sauvegarde durcie | Activer offsite age+rclone (mécanisme existant) ; `scripts/vps-restore-backup.sh` (sha256 obligatoire + `pg_restore` + comparaison manifeste) ; **supprimer l'auto-seed** de `deploy.yml` ; retirer/aligner les phases legacy de `deploy-to-vps.sh` ; WARN age-absent → refus en prod | La perte du VPS cesse d'être une perte totale ; le piège à données périmées est débranché ; le chemin de restauration existe enfin (TODO `procedures.md:135-136`) | **1-2 j** | Provisionner remote + paire age + escrow (~2 h) | Faible (scripts, pas d'app) | Phase 1 (comparaison manifeste) |
| **3** — Exercice #157 | Exécution du runbook §7 sur cible jetable, **depuis l'offsite chiffré** ; RTO/RPO consignés ; runbook corrigé par le vécu | La preuve que tout ça marche — obligation M8 P0 | **1 j** | ½ journée (exécution + consignation) | Faible (cible jetable) | Phase 2 |
| **4** — Fichiers : #209 | Merger #209 ; migrer les 2 routes scans vers `getStorage()` (inventaire déjà établi dans la PR) ; provisionner le bucket ; migrer les objets existants (`lib/storage/migrate.ts`) ; brancher la sauvegarde du bucket | **Correctif structurel n° 1** : la classe « fichiers détruits / non sauvegardés » devient impossible ; l'EACCES éventuel disparaît | **2-3 j** | Provisionner bucket + clés S3 (~1-2 h) ; QA upload/lecture scans | Moyen — les 2 routes sont le chemin de preuve en réclamation, tests ciblés exigés | D6, bucket provisionné |
| **5** — Cohérence du stockage | Contrôle « scans réellement accessibles » complet dans le manifeste (via `driver.exists()`) ; bannière admin d'incohérence ; test de restauration mensuel en CI (fixture) | Le diagnostic couvre enfin les fichiers, pas seulement la base | **1-2 j** | — | Faible | Phases 1 et 4 |
| **6** — Décommission + RGPD | Runbook de décommission (§5.3) ; inscription des migrations au registre (#153) ; politique de rétention des dumps offsite ; procédure d'effacement testée | La fin de vie des serveurs cesse d'être une fuite de données personnelles | **1 j** | Validation politique de rétention | Faible | Phase 3, coordination #153 |

**Le premier incrément — Phase 1, spécification d'exécution** (suffisamment précise pour être exécutée sans contexte additionnel) :

**Objectif** : au démarrage, l'application compare la base à ses propres exigences enregistrées ; tout écart est visible dans les logs, sur `/api/ready` et via CLI — sans jamais bloquer le service.

**Fichiers touchés (~10)** :
- `prisma/schema.prisma` : modèle `SystemManifest` (ligne unique, colonnes typées + `snapshot` JSONB — §3.2) ;
- `prisma/migrations/<date>_system_manifest/` : DDL additif (nouvelle table, zéro colonne modifiée) ;
- `lib/coherence/manifest.ts` **(nouveau)** : lecture/écriture de la ligne, calcul des compteurs, comparaison exigences↔environnement (empreinte scellement selon la convention #236 — `sha256(clé)` tronqué 12 hex ; présence clé de signature ; plancher schéma) ;
- `lib/coherence/check.ts` **(nouveau)** : agrégation `ok | degraded | incoherent`, détail par contrôle, **jamais de secret en sortie** ;
- `instrumentation.ts` : appel du contrôle dans `register()` (après l'init Sentry existant, l. 10-17), log `error` si incohérent ;
- `app/api/ready/route.ts` : bloc `coherence` (booléens + empreintes, statut 503 si `degraded`/`incoherent`) — **sans casser le contrat existant** (`SELECT 1` → `status: "ready"`) ni le futur bloc #236 (coordination : la PR #236 ajoute `sealFingerprint*` — mêmes champs, source = manifeste) ;
- `app/api/admin/coherence/route.ts` **(nouveau)** : rapport complet, protégé `getAdminUser` ;
- `scripts/coherence-check.ts` **(nouveau)** : `--snapshot` / `--check` / `--compare`, code retour non nul si incohérent ;
- `scripts/db-dump.ts` : inclure `SystemManifest` dans le dump JSON (il doit voyager avec la base) ;
- `tests/` (~4 fichiers) : empreinte attendue vs présente (3 cas : ok, absente, divergente) ; base sans manifeste → initialisation silencieuse ; assertions `not.toContain(secret)` ; idempotence du snapshot.

**Règles d'implémentation** :
- Aucun refus de servir, aucune exception au démarrage (même en cas d'incohérence — log + 503 `/api/ready` uniquement) ;
- La comparaison des compteurs ne s'exécute **pas** au démarrage ordinaire (dérive légitime) — seulement via `--check`/`--compare` ;
- Compatibilité avec un déploiement **sans** scellement (branches non mergées) : `sealFingerprint` `null` = contrôle sauté, pas d'échec ;
- Ne pas toucher aux nœuds critiques interdits (`lib/prisma.ts`, `lib/auth.ts`, etc. — liste #147) ; `instrumentation.ts` est le seul fichier partagé modifié, de façon additive.

**Critères d'acceptation** (gate `npm run verify`, `package.json:21` + sondes) :
1. Base avec manifeste + bonne clé → `/api/ready` 200, bloc `coherence.ok = true` ;
2. Clé de scellement divergente → `/api/ready` 503 avec `sealFingerprintMatch: false` **et le message distingue rotation et absence** — c'est le test qui prouve que l'incident vécu aurait été diagnostiqué ;
3. Base restaurée sans manifeste → initialisation, 200, alerte `info` ;
4. `--compare` entre deux instantanés d'un même dump → égalité exacte ; dump amputé d'une table → écart détecté, code retour non nul ;
5. Aucune valeur de secret dans aucune sortie (assertions de test).

---

## 9. Ce que cette conception ne protège PAS — l'honnêteté obligatoire

1. **Un serveur compromis qui ment.** Le manifeste est servi par le serveur lui-même : un attaquant root peut le falsifier comme il peut falsifier `/api/verifier`. La réponse complète (« le serveur ment sur son histoire ») est le journal de transparence — explicitement **différé** en phase 4 conditionnelle par #237 §10.2, et cette conception en hérite la limite.
2. **L'existence des sauvegardes elles-mêmes.** Si le cron n'est pas installé et l'offsite pas activé (P0), le manifeste ne fait que **mesurer** la perte. Un détecteur n'est pas un filet.
3. **Les fichiers d'ici #209.** Le RPO des fichiers est **infini** tant que le stockage objet n'est pas mergé : le manifeste détectera des scans manquants, il ne les ressuscitera pas. Toute migration réalisée avant la phase 4 est une **migration partielle assumée** (§7.1-A3).
4. **L'intégrité du *contenu* des fichiers.** Compteurs et existence, pas de hachage par fichier (D8) : un scan corrompu mais présent passe le contrôle. Parade future possible (sha256 à l'upload, métadonnées d'objet) — non incluse.
5. **La fraude interne.** Aucune cryptographie ne empêche l'organisation d'émettre un vrai certificat pour un faux candidat (#237 §9, dernière ligne — la gouvernance n'est pas un mécanisme).
6. **La perte des comptes SaaS** (Upstash, Pusher, Resend) : pas de données métier perdues, mais un service dégradé ; l'escrow de ces identifiants reste procédural.
7. **Les chiffres non mesurés.** RTO ≤ 30 min, ~5 $/mo, volumes : ce sont des **estimations** (❓). Elles deviennent des mesures à la phase 3 (#157). Un document d'architecture qui promettrait des RTO non exercés mentrait.
8. **La déduction EACCES** (§1.2-D2) n'est pas vérifiée : si elle est vraie, les uploads sont déjà cassés en production — le manifeste le révélera (scans référencés = 0 accessibles), #209 le réparera. Si elle est fausse, rien n'est perdu à l'avoir testée.
9. **Le multi-opérateur.** Toute la conception suppose un exploitant unique de confiance ; l'arrivée d'un second administrateur change le modèle de menace (cf. #237 §11 phase 4, déclencheur « multi-admins »).
10. **Cette conception ne remplace pas #160.** Elle rend le système sûr *autour* du livrable vertical ; elle ne livre rien du parcours produit, et ne doit pas consommer l'effort qui lui est dû.

---

## Décisions à valider

| # | Décision | Ma recommandation |
|---|---|---|
| **D1** | Adopter le manifeste porté par la base : table unique `SystemManifest`, ligne unique, colonnes typées pour les exigences + JSONB pour l'instantané (vs JSONB intégral, vs table par exigence) | **Oui** — deux natures de données (exigences stables / instantané mouvant), une table, lecture en une requête ; la ligne voyage dans tout `pg_dump`, c'est le mécanisme même de l'idée |
| **D2** | Comportement au démarrage : dégradé bruyant (log `error` + `/api/ready` 503 + rapport admin), **jamais** refus de servir | **Oui** — philosophie déjà tranchée par le scellement (`seal.ts` : « bloquer perdrait des attestations ») ; le healthcheck Docker sonde `/api/health` (`compose.prod.yml:68-77`), donc le 503 alerte sans bloquer les déploiements ; le pire serait de casser une production qui fonctionne |
| **D3** | Supprimer l'auto-seed `Backup/deploy-dump.sql` de `deploy.yml:80-96` et retirer/aligner les phases 1-4 legacy de `deploy-to-vps.sh` | **Oui** — ce n'est pas une sauvegarde, c'est un réservoir de données de dev branché en automatique sur la production ; le peuplement initial devient une étape explicite du runbook (dump horodaté + sha256 + manifeste) |
| **D4** | Chiffrement des dumps : activer le mécanisme age + rclone **existant** (`vps-pre-deploy-backup.sh:64-85`) plutôt qu'un nouvel outil ; transformer le WARN « age absent → envoi non chiffré » (l. 76) en **refus** en production | **Oui** — zéro invention, le mécanisme est écrit et documenté (`.env.example:89-95`) ; il n'a jamais été activé |
| **D5** | Escrow de la clé privée age : gestionnaire de mots de passe (primaire) + copie papier scellée (secondaire) ; **test de déchiffrement hors-site intégré à l'exercice #157** | **Oui** — même triple que #237 §6.5 ; un offsite jamais déchiffré ne vaut rien |
| **D6** | Merger #209 et finir la migration des 2 routes scans vers le stockage objet (le correctif structurel des fichiers), après provision du bucket | **Oui** — c'est le seul correctif qui rend la classe « fichiers détruits / non sauvegardés / EACCES » *impossible* ; la PR contient déjà l'inventaire ligne par ligne et l'outil de migration d'objets |
| **D7** | Compatibilité #237 : le manifeste porte `sealFingerprint` (voie HMAC) **et** `signingKeyExpectedId` (voie Ed25519) ; règle absolue : **aucun chemin de vérification n'exige la clé privée** | **Oui** — avec la signature, la preuve est auto-portée dans la ligne et la clé publique vit dans la base : une migration de la base seule préserve la vérification ; la clé privée ne conditionne que l'émission (dégradation rétrofittable, backfill #237 §5.4) |
| **D8** | Manifeste = compteurs par entité + empreintes ciblées + existence des objets ; **pas** de hash global de la base ni de hachage systématique par fichier | **Oui** — coût/fausses alertes sans bénéfice : l'intégrité par certificat est déjà portée par le sceau, celle du dump par le sha256 ; option v2 : sha256 par objet à l'upload |
| **D9** | Cadence : cron quotidien du backup (à installer — P0), exercice de restauration initial puis trimestriel, test de restauration mensuel en CI (fixture, incrément séparé) | **Oui** — conforme à #157 ; le test CI ne remplace jamais l'exercice complet (il ne teste pas l'offsite ni l'escrow) |
| **D10** | Décommission de l'ancien serveur : quarantaine 30 jours (❓ durée à valider), puis destruction du volume + des dumps + des secrets, révocation des clés, inscription au registre #153 ; constat honnête que l'effacement logiciel sur VPS n'est pas une garantie cryptographique | **Oui** — une migration est un transfert de données personnelles (RGPD + APDP, #153) ; l'ancien serveur est un traitement qui doit s'arrêter proprement |
| **D11** | **Action humaine immédiate** : vérifier sur le VPS la déduction EACCES (§1.2-D2) — `docker exec attestations-fsa-prod sh -c 'mkdir -p public/uploads/test; mkdir -p private/uploads/test'` | **Oui** — 2 minutes ; si l'écriture échoue, les uploads sont déjà cassés en production et la phase 4 monte en priorité |
| **D12** | Harmoniser les deux chemins d'app du VPS (`/home/audest/attestations-fsa` vs `/home/audest/attestation-fsa`, `deploy.yml:50` vs `deploy-to-vps.sh:37`) | **Oui** — prérequis d'hygiène : deux stacks divergentes rendent toute procédure de restauration ambiguë |

---
