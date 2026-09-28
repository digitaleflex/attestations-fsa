# Inventaire des fonctionnalités et matrice de dépendances

Date : 2026-09-26
Base auditée : branche `chore/node-24-lts`
Périmètre : `app/`, `lib/`, `prisma/`, `scripts/`, `.github/workflows/`, `tests/`, `e2e/`
Exclusions : worktrees, build, sauvegardes locales, rapports générés et archives.

## 1. Synthèse

| Indicateur | Total | Livrées | Partielles | Absentes |
|---|---:|---:|---:|---:|
| P0 | 31 | 13 | 4 | 14 |
| P1 | 39 | 19 | 6 | 14 |
| P2 | 30 | 14 | 4 | 12 |
| P3 | 4 | 0 | 0 | 4 |
| **Total** | **104** | **46** | **14** | **44** |

Niveaux :

- **P0** : sécurité, preuve officielle, intégrité, production bloquante.
- **P1** : parcours métier, conformité, administration et exploitation.
- **P2** : robustesse, analytics, support et finition.
- **P3** : fonctions announced/low impact ou dépendantes d’une décision produit.

## 2. Inventaire par criticité

### P0 — bloquant production

| ID | Fonctionnalité | Acteur | Statut | Dépendances | Preuve / suivi |
|---|---|---|---|---|---|
| ATT-02 | Émission automatique d’une certification après examen validé | Système | Livrée | EXA-05, SEC-05 | `issue.ts`, tests attestation |
| ATT-04 | Sceau HMAC versionné | Opérateur | Livrée | SEC-05 | `lib/crypto/seal.ts`, tests seal |
| ATT-05 | PDF serveur, hash, version et stockage R2 | Opérateur | Livrée | OPS-07 | `lib/attestations/pdf.ts`, tests PDF |
| ATT-09 | Attestation d’une demande de stage | Admin | Absente | STG-04, STG-05 | #265 |
| ATT-10 | Suppression physique interdite et registre de révocation | Admin | Absente | ATT-04 | #299/#301 |
| ATT-03 | Codes FSA immuables et numérotation unique | Système | Partielle | — | #316 pour séquence concurrente |
| ATT-06 | Vérification publique par code et QR | Public | Partielle | ATT-04/05, SEC-04 | #281 |
| EXA-02 | Passer un examen en trois parties | Candidat | Livrée | EXA-04 | tests examens + E2E |
| EXA-04 | Barème et scoring reproductibles | Système | Livrée | — | `lib/exams/scoring.ts` |
| EXA-05 | Transitions de session et correction sûre | Système | Livrée | EXA-04 | tests correction |
| EXA-06 | Éligibilité OFFICIAL via `ExamEnrollment` | Candidat | Livrée | — | tests enrollment |
| EXA-07 | Fuseau `Africa/Porto-Novo` | Système | Livrée | — | `lib/exams/time.ts` |
| EXA-08 | `opensOn` et cron d’ouverture | Système | Livrée | EXA-06/07 | route cron + migration |
| EXA-09 | Masquage du contenu d’un examen futur | Candidat | Livrée | EXA-07 | tests visibilité future |
| STG-04 | Machine à états des demandes de stage | Admin | Absente | — | #267 |
| STG-05 | Validation stricte des données de stage | Admin | Absente | STG-04 | #266 |
| STG-08 | CV contrôlé par clé R2, sans URL libre | Candidat | Absente | OPS-07 | #264 |
| ADM-01 | Auth admin, 2FA et verrouillage | Admin | Livrée | SEC-01 | tests admin auth |
| ADM-11 | Statut `BLOCKED/SUSPENDED` appliqué | Sécurité | Absente | — | #304 |
| SEC-01 | Secret d’authentification obligatoire en production | Opérateur | Livrée | — | #282 |
| SEC-02 | `trustedOrigins` strictes | Opérateur | Absente | — | #283 |
| SEC-03 | Restriction `next/image` contre SSRF | Opérateur | Absente | — | #284 |
| SEC-04 | Whitelist publique du vérificateur | Public | Absente | — | #281 |
| OPS-03 | Manifeste de sauvegarde et restauration isolée | Opérateur | Livrée | — | scripts backup |
| OPS-04 | Export de référence versionné | Opérateur | Livrée | OPS-03 | `reference-export.ts` |
| OPS-05 | Classification read-only des 40 attestations | Opérateur | Livrée | OPS-04 | tests migration |
| OPS-06 | Backup/restore/versioning/fraîcheur R2 | Opérateur | Livrée | OPS-07 | scripts R2 + 41 assertions |
| OPS-07 | Registre `StoredObject` | Système | Livrée | — | storage tests |
| OPS-12 | Sauvegarde hors site chiffrée et RPO/RTO | Opérateur | Absente | OPS-03/06 | #306 |
| OPS-14 | Continuité domaine/opérateur/QR | Opérateur | Absente | — | #305 |
| INS-01 | Inscription publique multi-étapes | Public | Livrée | SEC-01 | E2E candidat |

### P1 — métier et conformité

| ID | Fonctionnalité | Acteur | Statut | Dépendances | Preuve / suivi |
|---|---|---|---|---|---|
| EXA-01 | Création/édition d’un examen | Admin | Livrée | — | tests builder |
| EXA-03 | Sauvegarde de brouillon | Candidat | Livrée | — | tests draft |
| EXA-12 | Détection anti-triche réelle | Candidat | Absente | — | #277, `useExamMonitoring` absent |
| EXA-14 | Correction manuelle parties 2/3 | Admin | Livrée | EXA-05 | tests correction |
| ATT-01 | Création manuelle d’attestation | Admin | Livrée | SEC-05 | tests création |
| ATT-07 | Claim d’attestation par code | Candidat | Partielle | SEC-04 | #303 |
| ATT-08 | Rescellement d’une correction approuvée | Admin | Livrée | ATT-04 | tests reseal |
| ATT-11 | Sceau v2 pour toutes attestations | Système | Partielle | ATT-04 | #300 |
| ATT-13 | Interdiction des PII fictives | Admin | Absente | — | #302 |
| ATT-14 | Générateur PDF versionné et validé | Opérateur | Partielle | ATT-05 | #307 |
| ATT-19 | Rétention, suppression CV et export PII | Opérateur | Absente | OPS-07 | #269 |
| RES-01 | Résultats et détail de session | Candidat | Livrée | EXA-05 | tests résultats |
| INS-02 | Inscription à une formation | Candidat | Livrée | INS-01 | tests inscription |
| INS-03 | Vérification email | Candidat | Livrée | INS-01 | tests email |
| FOR-01 | Catalogue public des formations | Public | Livrée | — | `data-public.ts` |
| FOR-02 | CRUD des formations | Admin | Partielle | — | détails incomplets |
| STG-01 | Candidature publique avec CV | Public | Livrée | SEC-03 | tests internships |
| STG-02 | Suivi des demandes côté candidat | Candidat | Partielle | STG-01 | #270 |
| STG-03 | Gestion admin et export des demandes | Admin | Partielle | STG-04 | #270/#278 |
| NOT-03 | Emails de notification | Système | Partielle | INS-03 | #268/#312 |
| ADM-02 | Dashboard admin et KPI | Admin | Livrée | — | dashboard |
| ADM-03 | Gestion utilisateurs et audit utilisateur | Admin | Livrée | ADM-01 | tests users |
| ADM-04 | Journal d’audit consultable | Admin | Partielle | — | #293 |
| ADM-10 | RBAC minimal administrateur | Admin | Absente | — | #286 |
| SEC-05 | Émission bloquée sans clé de sceau | Système | Livrée | ATT-04 | #288 |
| SEC-06 | Rate limiting fiable et fail-closed | Système | Partielle | OPS-07 | #287/#310 |
| SEC-07 | CSP avec nonces | Opérateur | Absente | — | #290 |
| SEC-08 | `sanitizeHTML` effectivement branché | Système | Absente | — | #289 |
| SEC-12 | Anti-force brute du claim | Candidat | Absente | SEC-06 | #303 |
| OPS-02 | `/api/ready` DB/cache | Opérateur | Absente | — | #292 |
| OPS-09 | CI quality, SCA, tests et E2E | Opérateur | Livrée | — | workflow test |
| OPS-10 | Rollback applicatif par SHA | Opérateur | Absente | OPS-09 | #294 |
| OPS-11 | Alertes planifiées R2/readiness | Opérateur | Partielle | OPS-02/06 | #295 |
| QLT-01 | Tests unitaires et API | Opérateur | Livrée | — | 1053 tests |
| QLT-02 | E2E candidat, admin, examen, vérification | Opérateur | Partielle | QLT-01 | #272 |
| DAT-01 | Funnel inscription → attestation | Opérateur | Absente | — | #314 |
| DAT-02 | Statistiques publiques agrégées | Public | Absente | ADM-02 | #315 |
| DAT-03 | Fuseau et formats de dates globaux | Système | Partielle | EXA-07 | #317 |
| DAT-04 | Séquence transactionnelle des codes FSA | Système | Absente | ATT-03 | #316 |

### P2/P3 — robustesse et produits annoncés

| ID | Fonctionnalité | Acteur | Statut | Dépendances | Preuve / suivi |
|---|---|---|---|---|---|
| ATT-12 | Rotation de clé de scellement | Opérateur | Absente | ATT-04 | #308 |
| ATT-15 | Distinguer `REJECTED` et `REVOKED` | Public | Absente | ATT-10 | #309 |
| ATT-16 | Invariants de validation attestation | Admin | Absente | ATT-13 | #322 |
| EXA-10 | Countdown et UI planning | Candidat | Livrée | EXA-07 | tests UI |
| EXA-11 | Expiration des sessions abandonnées | Système | Absente | EXA-03 | #318 |
| EXA-13 | Monitoring des examens | Opérateur | Absente | EXA-12 | #276 |
| RES-02 | Transcripts/relevés officiels | Candidat | Absente | RES-01 | #275 |
| RES-03 | Réclamations sur les notes | Candidat | Livrée | EXA-05 | tests réclamations |
| FOR-03 | Pas de pollution du catalogue | Système | Absente | — | #319 |
| STG-06 | Quotas de candidature séparés | Candidat | Absente | SEC-06 | #271 |
| STG-07 | E2E demandes de stage | Opérateur | Absente | QLT-02 | #272 |
| NOT-01 | Liste/lecture des notifications | Candidat | Livrée | — | tests notifications |
| NOT-02 | Notifications admin et envoi masse | Admin | Livrée | — | tests bulk |
| NOT-05 | Statut de livraison des emails | Opérateur | Absente | NOT-03 | #296 |
| ADM-05 | Traitement des corrections | Admin | Livrée | — | tests corrections |
| ADM-06 | Traitement des réclamations | Admin | Livrée | — | tests réclamations |
| ADM-07 | Paramètres et identité institutionnelle | Admin | Livrée | ATT-01 | tests settings |
| ADM-08 | Suivi support candidat | Candidat | Absente | — | #273 |
| ADM-09 | Pages légales et cookies conformes | Public | Partielle | — | #313 |
| SEC-09 | CSRF aligné avec documentation | Système | Partielle | SEC-02 | #285 |
| SEC-10 | Export/effacement RGPD | Candidat | Absente | OPS-07 | #291 |
| OPS-01 | Liveness `/api/health` | Opérateur | Livrée | — | tests health |
| OPS-08 | Sentry avec scrub PII | Opérateur | Livrée | — | tests scrub |
| OPS-13 | Logs structurés et corrélation | Opérateur | Absente | ADM-04 | #321 |
| OPS-15 | Audit intégrité et normalisation notes | Opérateur | Livrée | — | scripts data |
| QLT-03 | Seuil de couverture bloquant | Opérateur | Livrée | QLT-01 | `vitest.config` |
| QLT-04 | Tests accessibilité | Utilisateur | Livrée | QLT-01 | tests a11y |
| QLT-05 | Agents et revue automatisée | Opérateur | Livrée | — | workflows agents |
| DAT-05 | Purge stockage et quotas compte | Opérateur | Absente | OPS-07 | #320 |
| DAT-06 | Documentation alignée sur le produit | Opérateur | Absente | état final | #297 |
| ATT-17 | Signature Ed25519 | Opérateur | Absente | ATT-04 | #280 |
| ATT-18 | Actions groupées attestations | Admin | Absente | ATT-10 | #279 |
| NOT-04 | Notifications temps réel | Candidat | Absente | NOT-01/05 | absente |
| ADM-12 | Pages détail admin manquantes | Admin | Absente | ADM-04 | #278 |

## 3. Dépendances critiques

```text
OPS-03 sauvegarde + OPS-07 StoredObject + SEC-05 sceau + OPS-09 CI
        ↓
ATT-04 sceau → ATT-05 PDF → ATT-06 vérification
        ↓                              ↑
SEC-04 whitelist PII ────────────────┘

EXA-07 Porto-Novo → EXA-08 opensOn/cron → EXA-09 visibilité
        ↓
EXA-06 éligibilité → EXA-02 examen → EXA-05 correction → RES-01 résultats
        ↓
ATT-02 certification automatique

STG-04 machine à états → STG-05 validation → ATT-09 attestation stage
        ↓
ATT-10 révocation + ATT-13 PII + FOR-03 catalogue

OPS-02 /api/ready → OPS-11 alertes → OPS-12 RPO/RTO
SEC-06 rate limit → SEC-12 anti-force brute claim
ADM-01 auth + ADM-10 RBAC + ADM-11 statut compte
```

## 4. Ordre d’implémentation recommandé

### Vague A — sécurité et preuve P0

1. SEC-04 whitelist du vérificateur (#281)
2. SEC-02 trustedOrigins (#283)
3. SEC-03 next/image (#284)
4. SEC-06 rate limit fail-closed et upload (#287/#310)
5. STG-04 machine à états (#267)
6. STG-05 + ATT-09 (#266/#265)
7. ADM-11 statut de compte (#304)
8. ATT-10 suppression/révocation (#299/#301)

### Vague B — preuve et conformité

1. ATT-11 sceau v2 global (#300)
2. ATT-13 PII fictives (#302)
3. SEC-12 claim-code (#303)
4. OPS-02 `/api/ready` (#292)
5. OPS-12 sauvegarde hors site/RPO/RTO (#306)
6. STG-08 URLs CV (#264)

### Vague C — plateforme

1. ADM-10 RBAC (#286)
2. OPS-10 rollback (#294) + OPS-11 alertes (#295)
3. ADM-04 page audit (#293)
4. SEC-07/08/09 CSP, sanitation, CSRF (#289/#290/#285)

### Vague D — produits annoncés

1. EXA-12 anti-triche (#277)
2. DAT-04 séquence FSA (#316)
3. FOR-03 catalogue (#319)
4. STG-02/03 UI/API et détails (#270/#278)
5. NOT-03 outbox/retry (#268/#312)

### Vague E — finition

1. EXA-11 et EXA-13 (#318/#276)
2. RES-02 transcripts (#275)
3. STG-06 quotas et STG-07 E2E (#271/#272)
4. DAT-06 documentation finale (#297)

## 5. Fonctionnalités critiques non livrées

Priorité immédiate :

- **ATT-09** : attestation stage sans `ACCEPTED` ni déduplication.
- **STG-04/STG-05** : workflow stage non fiable.
- **STG-08** : CV utilisateur non contrôlé.
- **SEC-04** : PII dans le vérificateur public.
- **SEC-02** : origines de confiance trop larges.
- **SEC-03** : SSRF via `next/image`.
- **ADM-11** : blocage de compte sans effet.
- **ATT-10** : suppression physique d’un document officiel.
- **OPS-02/OPS-12** : readiness et reprise après sinistre absentes.

## 6. Écarts documentaires

- `BACKLOG.md` annonce `lib/useExamMonitoring.ts`, absent du code.
- La cartographie de couverture produit est optimiste et doit être réconciliée après les correctifs (#297).
- `PROGRESS.md` annonce des E2E/coverage non rejoués sur le périmètre complet.
- Le statut « livré » signifie implémenté et testé, pas nécessairement clôture GitHub ni validation juridique.
