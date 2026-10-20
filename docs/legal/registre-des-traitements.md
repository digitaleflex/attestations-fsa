# Registre des traitements

> **Généré automatiquement** par `scripts/generate-processing-register.mjs` — ne pas
> éditer à la main. Source de vérité : `prisma/schema.prisma`.
>
> Obligation RGPD art. 30 / APDP Bénin. Généré le **2026-10-20** :
> 23 tables classifiées.

## Comment lire ce registre

Ce registre décrit ce que la plateforme traite **réellement aujourd'hui**. Il est
dérivé du schéma Prisma plutôt qu'écrit à la main, donc il ne peut pas dériver du
produit après une migration.

La **durée de conservation** n'est pas décidée ici : elle fait l'objet de
`docs/legal/retention-policy.md`, qui reste la source unique et définit le champ
technique (`StoredObject.retentionUntil`, `AUDIT_LOG_RETENTION_DAYS`) et les jobs
de purge.

## Données collectées — vue d'ensemble

| Catégorie | Contenu |
| :--- | :--- |
| **Identité** | Nom, prénom, date et lieu de naissance, sexe |
| **Contact** | Adresse e-mail, téléphone, adresse postale |
| **Pédagogique** | Examens passés, scores, mentions, attestations, QR de vérification |
| **Documents** | CV, scans de copies d'examen, PDF d'attestation officiels |
| **Sécurité** | Journal d'audit, IP, journaux anti-triche, secrets 2FA |

## Traitements par finalité

| Table | Nature | Finalité | Base légale | Conservation |
| :--- | :--- | :--- | :--- | :--- |
| `Account` | Donnée personnelle | Authentification (mot de passe haché, jetons OAuth) | Exécution du contrat | Jusqu'à l'effacement du compte — purgé à l'anonymisation |
| `Session` | Donnée personnelle | Maintien de la session authentifiée | Exécution du contrat | Expirée automatiquement ; révoquée à l'effacement |
| `Verification` | Donnée personnelle | Vérification d'adresse e-mail, réinitialisation de mot de passe, OTP 2FA | Exécution du contrat | Courte — purgé à l'anonymisation du compte |
| `User` | Donnée personnelle | Gestion de compte candidat, authentification, suivi pédagogique | Exécution du contrat (préinscription, inscription, passage d'examen) | Jusqu'à la demande d'effacement, puis anonymisation (#291) |
| `TwoFactor` | Donnée personnelle | Second facteur d'authentification administrateur (décision #74) | Exécution du contrat | Tant que le 2FA est actif ; purgé à l'effacement |
| `Formation` | Donnée non personnelle | Catalogue de formations | Intérêt légitime | Durée de vie de la formation |
| `Attestation` | Donnée personnelle | Délivrance, vérification et révocation d'attestations — PIÈCE PROBANTE | Obligation légale | Illimitée — attestation émise non destructible |
| `Settings` | Donnée non personnelle | Paramètres de la plateforme | Intérêt légitime | Durée de vie |
| `Report` | Donnée personnelle | Signalement d'un contenu (fusionné avec Contact, #110) | Intérêt légitime | Durée du traitement du signalement |
| `Exam` | Donnée non personnelle | Définition et planification des examens | Exécution du contrat | Durée de vie de l'examen |
| `ExamPart` | Donnée non personnelle | Structure d'un examen | Exécution du contrat | Durée de vie de l'examen |
| `Question` | Donnée non personnelle | Banque de questions | Exécution du contrat | Durée de vie de l'examen |
| `QuestionOption` | Donnée non personnelle | Réponses possibles | Exécution du contrat | Durée de vie de l'examen |
| `ExamSession` | Donnée personnelle | Passage d'examen, calcul de score, attestation — PIÈCE PROBANTE | Obligation légale et contractuelle | Illimitée — session probante conservée |
| `ExamEnrollment` | Donnée personnelle | Liaison candidat ↔ examen ↔ promotion | Exécution du contrat | Durée du suivi pédagogique |
| `InternshipRequest` | Donnée personnelle | Demande, suivi et évaluation de stage | Exécution du contrat | Durée du stage + durée légale |
| `CorrectionRequest` | Donnée personnelle | Contestation d'un résultat par le candidat | Obligation légale | Durée du dispositif de recours |
| `AuditLog` | Donnée personnelle | Traçabilité des actions d'administration — obligation de preuve | Obligation légale | 365 jours (`AUDIT_LOG_RETENTION_DAYS`), purgée par le cron |
| `Notification` | Donnée personnelle | Notifications in-app (résultats, validations) | Exécution du contrat | Jusqu'à suppression par l'utilisateur |
| `Contact` | Donnée personnelle | Prise de contact depuis le site public | Intérêt légitime / demande de la personne | Durée du traitement de la demande |
| `Reclamation` | Donnée personnelle | Réclamation et litige | Obligation légale | Durée du dispositif de recours |
| `StoredObject` | Donnée personnelle | Stockage des fichiers déposés : CV, scans de copies, PDF officiels | Exécution du contrat / obligation légale | 365 j (non probants) ; illimitée (PDF officiels) — `retentionUntil` |
| `Consent` | Donnée personnelle | Preuve des acceptations (CGU, confidentialité, transferts hors UE) et des retraits — RGPD art. 7 | Consentement / exécution du contrat | Tant que le compte existe — append-only, jamais supprimé (une révocation ne détruit pas la preuve du retrait) |

## Sous-traitants

| Sous-traitant | Rôle | Données | Localisation | Cadre |
| :--- | :--- | :--- | :--- | :--- |
| Resend | Envoi d'e-mails (verification, notifications, OTP) | Adresse e-mail, nom | États-Unis | EU-US Data Privacy Framework |
| Cloudflare R2 | Stockage objet des fichiers | Contenu de fichier, clé de stockage | États-Unis | À vérifier avant mise en production (sous-traitance hors UE) |
| Upstash Redis | Rate limiting, cache de session technique | Clés de rate limit, jetons | États-Unis | À vérifier avant mise en production |

> Les deux mentions « à vérifier » doivent être levées avant la mise en production
> (#153) : sans Garantie de sous-traitance correcte, un transfert hors UE n'est pas
> encadré. À traiter avec l'APDP.

## Transferts hors UE

La plateforme est hébergée hors de l'Union européenne. Tout transfert repose sur
les garanties listées ci-dessus. **Point ouvert** : les garanties de Cloudflare R2
et d'Upstash doivent être confirmées et versées au dossier avant ouverture du
service aux candidats (cf. #153).

## Sécurité au repos — point ouvert

- **OTP et codes de secours 2FA** : chiffrés en production (`storeOTP` /
  `storeBackupCodes` = `encrypted`, `lib/auth.ts`).
- **Mots de passe** : hachés par Better Auth, jamais stockés en clair.
- **Fichiers déposés (CV, scans)** : **chiffrés au repos**. Le driver S3/R2
  demande explicitement un chiffrement serveur à chaque écriture
  (`ServerSideEncryption: "AES256"`, `lib/storage/s3-driver.ts`), en plus du
  chiffrement que le fournisseur applique par défaut. Un SHA-256 d'`intégrité`
  est également calculé et stocké (`computeChecksum`,
  `lib/storage/registry.ts`).
  *Pourquoi côté fournisseur et pas dans l'application* : les lectures passent
  par des URL signées, donc le client récupère les octets directement du object
  store. Un chiffrement applicatif lui servirait du chiffré au lieu du PDF.
- **Disque local du VPS** : les volumes d'uploads et les dumps de sauvegarde
  locaux ne sont **pas** chiffrés au repos ; ils sont protégés par
  `chmod 600` et les copies hors site le sont par `age`
  (`scripts/vps-pre-deploy-backup.sh`).

## Droits des personnes

| Droit | Mise en œuvre |
| :--- | :--- |
| **Accès / portabilité** | `GET /api/user/export` — export des données personnelles |
| **Effacement** | `DELETE /api/users/[id]` — anonymisation transactionnelle, preservatives des obligations probantes (#291, action `ACCOUNT_ANONYMIZED`) |
| **Conservation** | `docs/legal/retention-policy.md` + cron `retention-purge` |
| **Rectification** | `PATCH /api/users/[id]` et `/api/user/profile` |
| **Retrait du consentement** | `POST /api/user/consent` — révocation de `MARKETING` ; pour les autres, l'effacement du compte |
| **Opposition** | Contact via `/contact` — **traitement manuel, aucune procedure automatisee** |

---

## Ce qui reste à faire (cf. #153)

1. **Levée de la réserve sur les transferts hors UE** (Cloudflare R2, Upstash) —
   cadre contractuel à confirmer, hors code.
2. **Chiffrement du disque local du VPS** — les volumes d'uploads et les dumps
   locaux ne sont pas chiffrés au repos (protégés par `chmod 600`, et par
   `age` pour les copies hors site). À traiter comme une opération de
   migration, pas comme un correctif.
3. **Récupération des consentements pour les comptes créés avant #153** — les
   inscriptions postérieures enregistrent désormais leur acceptation
   (clickwrap sur `app/(public)/inscription/page.tsx`), mais les comptes
   antérieurs n'ont aucune ligne `Consent`. Une reprise manuelle ou une
   demande d'acceptation à la première connexion reste à décider.
