# Décisions bloquantes — recommandations

> Issue : **#159** (M8 — Prérequis production, **P0 — débloque le reste**).
> Statut de ce document : **RECOMMANDATIONS**. Elles ne sont **pas** des décisions
> finales. Chaque point attend une **validation humaine** (produit / sécurité /
> données) qui vaut décision, avec responsable et date.
>
> Chaque recommandation a été postée en commentaire `DÉCISION RECOMMANDÉE : …`
> dans son issue d'origine pour traçabilité.

---

## 1. Tableau récapitulatif

| Issue | Sujet | Recommandation | Nature | Bloque quoi |
| --- | --- | --- | --- | --- |
| [#74](https://github.com/digitaleflex/attestations-fsa/issues/74) | 2FA admin | **CONSERVER** (sous-item 2FA) | Sécurité | Dégraissage #87, back-office |
| [#74](https://github.com/digitaleflex/attestations-fsa/issues/74) | OTP logs | **RETIRER** (store mémoire non fiable) | Données | #87 |
| [#83](https://github.com/digitaleflex/attestations-fsa/issues/83) | Dark mode | **ABANDONNER** (Option A) | Design | #42, #87 |
| [#86](https://github.com/digitaleflex/attestations-fsa/issues/86) | Features fantômes | **SUPPRIMER** les 4 | Périmètre | #67, #31, doc |
| [#98](https://github.com/digitaleflex/attestations-fsa/issues/98) | Feedback 4 → 2 | **CONFIRMER la cible, SÉQUENCER après #160** | Données | #87, #99 |
| [#110](https://github.com/digitaleflex/attestations-fsa/issues/110) | Fusion Report + Contact | **Cible validée, exécution après #160** | Données | #98 |
| [#111](https://github.com/digitaleflex/attestations-fsa/issues/111) | Fusion Reclamation + CorrectionRequest | **Cible validée, exécution après #160** | Données | #98 |
| [#94](https://github.com/digitaleflex/attestations-fsa/issues/94) | Transcript / relevé | **RETIRER**, sauf référentiel externe (précondition) | Périmètre | #87, #99 |
| [#95](https://github.com/digitaleflex/attestations-fsa/issues/95) | Scans de copies | **CONSERVER** (examens hybrides) | Cœur métier | #87 |
| [#124](https://github.com/digitaleflex/attestations-fsa/issues/124) | `internshipScore` | **Composant séparé, hors `finalScore`** (déjà appliqué) | Cœur métier | Libellés UI/PDF |
| [#69](https://github.com/digitaleflex/attestations-fsa/issues/69) | CSRF / BotID | **CONFIRMER LE RETRAIT** | Sécurité | #65, dépendances |

**Légende** : « Nature » indique le type de validation requise, pas une priorité.

---

## 2. Détail des recommandations

### #74 — 2FA admin : CONSERVER

**Recommandation** : conserver la 2FA admin (ni gel, ni retrait). Les autres
sous-items de #74 se tranchent séparément : OTP logs → **RETIRER** ; transcript →
voir #94 ; scans → voir #95.

**Justification technique**
- Implémentation complète et alignée sur better-auth ≥ 1.7 : plugin `twoFactor`,
  modèle `TwoFactor` (`secret`, `backupCodes`, `verified`,
  `failedVerificationCount`, `lockedUntil`), pages `app/admin/2fa/{setup,verify}`,
  champ `User.twoFactorEnabled`.
- Le rôle admin peut **émettre, corriger et révoquer** des certificats (valeur
  probante, cf. #155). C'est le compte le plus sensible de la plateforme :
  retirer la 2FA est une régression de sécurité non compensée.
- « Geler » (dé-annoncer sans forcer) ne supprime aucun code : on conserve le coût
  de maintenance d'un code non testé sans le bénéfice. C'est de la dette
  déguisée, pas une décision.
- Coût résiduel faible : 1 modèle, 1 plugin, 2 pages, `react-qr-code`.

**Conséquence** : clore le sous-item « 2FA » de #74 en **CONSERVÉ**. Si l'on veut
aller plus loin, créer une issue P2 « Forcer la 2FA pour le rôle admin »
(enrôlement obligatoire + codes de secours), sans toucher au code existant.

**Décision finale attendue de** : sécurité + produit.

---

### #74 (sous-item) — OTP logs : RETIRER

**Recommandation** : retirer `lib/otp-store.ts`, `app/api/admin/otp-logs/route.ts`
et `app/admin/otp-logs/page.tsx`.

**Justification technique** : le store est **en mémoire** → perdu à chaque
redémarrage / déploiement, et non partagé entre instances. Il ne peut donc pas
servir de preuve d'audit. Un audit OTP réel se ferait en base (modèle dédié ou
`AuditLog`), ce qui n'est pas demandé aujourd'hui.

---

### #83 — Dark mode : ABANDONNER

**Recommandation** : **Option A** — abandonner le dark mode et supprimer les
résidus.

**Justification technique**
- Aucun `next-themes` / `ThemeProvider` / toggle : le mode sombre n'est **pas
  atteignable** par l'utilisateur. Seules 2 occurrences `dark:` subsistent
  (`components/ui/alert.tsx`, `components/ui/chart.tsx`), génériques shadcn.
- `globals.css` définit un bloc `.dark` **jamais activé** → code mort.
- La refonte #42 est **light-only** et `Design.md` proscrit les fonds sombres :
  implémenter le dark mode (Option B) contredit la direction design validée.
- Option B = tokens sombres + audit de contraste + tests sur tout l'admin et
  l'espace candidat : coût élevé pour un besoin non exprimé.

**Conséquence** : suppression du bloc `.dark` et des 2 `dark:` résiduels dans une
issue de nettoyage (pas dans #83) ; documenter « light-only » dans `docs/README.md`.

**Décision finale attendue de** : produit + design.

---

### #86 — Features fantômes : SUPPRIMER les 4

**Recommandation** : **supprimer** chat, ressources pédagogiques, portfolio,
waitlist (documentation + liens morts).

**Justification technique**
- Vérifié : **0 modèle Prisma, 0 route, 0 page** pour les 4. La documentation
  décrit du non-existant — dont un « 85 % » dans `PROGRESS.md` — ce qui induit en
  erreur toute nouvelle session (humaine ou agent) et fausse la planification.
- **Hors mission** : inscription formation · candidature stage · examen ·
  résultats · certificat + vérification publique.
- Le dégraissage #67 prévoit déjà la suppression des docs fantômes : cette issue
  confirme la cible et borne le nettoyage des mentions.

**Conséquence** : supprimer `docs/chat-system/`, `docs/resources-management/` ;
retirer les mentions portfolio (`/p/[slug]`, `/portfolios`), waitlist et le lien
`/admin/waitlist` ; corriger `PROGRESS.md`, `docs/PLATEFORME_COMPLETE.md`, le
footer ; clore #31. **Règle** : pas de doc pour du code inexistant.

**Décision finale attendue de** : produit.

---

### #98 — Feedback 4 → 2 : CONFIRMER la cible, SÉQUENCER après #160

**Recommandation** : confirmer les **2 canaux** cibles, mais **ne pas exécuter
maintenant** — séquencer après le slice vertical #160.

**Périmètre final proposé**
1. **Support général** ← `Report` + `Contact` (champ `category` discriminant).
2. **Litige / correction** ← `Reclamation` + `CorrectionRequest` (champ `type`
   discriminant ; `Reclamation` **conservée**, besoin métier validé).

**Justification technique**
- La fusion impose une **migration de données** quasi irréversible (drop de
  modèles en #99). `Contact` a 3 flux (contact public, inscription formation,
  admin) et `CorrectionRequest` 3 flux : risque de perte élevé, sans bénéfice
  pour la mise en production.
- #160 interdit explicitement le « dégraissage large #87 » avant que le slice
  (inscription → examen → résultat → certificat + vérification) ne soit **vert et
  déployé**.
- Aucune route morte concernée n'est bloquante en prod : le dégraissage peut
  attendre sans coût.

**Séquence** : #160 vert → #98 (migration testée sur staging #156) → #99 (drop).

**Décision finale attendue de** : produit + données.

---

### #110 — Fusion `Report` + `Contact` : cible validée, exécuter après #160

**Recommandation** : cible confirmée (un modèle « support général » unique avec
`category` : `CONTACT_PUBLIC | FORMATION_INSCRIPTION | SIGNALEMENT | ADMIN`),
exécution **après** #160.

**Justification technique** : `Contact` est écrite par `/api/formations/inscription`
— c'est-à-dire le **parcours CŒUR** (inscription). Une fusion qui touche le chemin
d'inscription ne doit pas précéder le gel du slice vertical, et doit être testée
sur staging (#156) avec les 3 flux vérifiés avant/après.

**Décision finale attendue de** : produit + données.

---

### #111 — Fusion `Reclamation` + `CorrectionRequest` : cible validée, exécuter après #160

**Recommandation** : cible confirmée (un canal « litige/correction » avec `type`
discriminant ; `Reclamation` **conservée**), exécution **après** #160.

**Justification technique** : les deux modèles portent des **relations
différentes** — `Reclamation` → `ExamSession` (litige de note) et
`CorrectionRequest` → `Attestation` + `User` (correction d'identité). Les aplatir
sans casser les écrans admin (`/admin/reclamations`, `/admin/corrections`) exige
une migration testée (#99) et ne doit pas précéder #160.

**Décision finale attendue de** : produit + données.

---

### #94 — Transcript / relevé : RETIRER (sous précondition)

**Recommandation** : **retirer** le transcript — **sauf** si le client confirme
qu'un référentiel de certification externe l'exige (c'est la précondition posée
par l'issue elle-même). En l'absence de cette confirmation, retirer.

**Justification technique**
- **Aucun référentiel de certification externe n'est documenté dans le dépôt**
  (recherche `référentiel` : aucun référentiel de certification, seulement des
  référentiels de développement).
- #74 porte déjà l'arbitrage client « non retenu comme besoin métier ».
  `docs/results-transcripts/01-consultation-resultats.md` le présente comme
  « para Académique » et **surestime l'avancement** (« 80 % — En production »).
- **Chevauchement fonctionnel** : « Mes résultats » + l'attestation couvrent le
  besoin candidat. Le relevé multi-sessions est un document annexe non demandé
  par la mission.
- **Coût de retrait faible et borné** : 1 page, 2 routes actives (+1 déjà morte),
  1 composant ; les 4 liens entrants sont identifiés dans l'issue
  (`dashboard`, `admin/attestations` ×3) → objectif **0 lien mort**.

**Précaution** : `lib/exams/scoring.ts` est **partagé** et ne doit pas être
touché. `ExamSession.transcriptDownloadedAt` et
`sendOfficialTranscriptNotification` (`lib/email.ts`) se nettoient en #99, pas ici.

**Décision finale attendue de** : client (existe-t-il un référentiel ?) → si non,
produit.

---

### #95 — Scans de copies : CONSERVER

**Recommandation** : **conserver** l'upload/consultation des scans.

**Justification technique**
- Le schéma décrit des examens **hybrides**, pas 100 % digitaux : `part3Mode`
  (défaut `"digital"` mais configurable), `part2Enabled/part2Points`,
  `part3Enabled/part3Points`, `part3Subject` (sujet d'étude de cas), et
  `ExamSession.scorePart2/scorePart3` **nullables** (= parties à corriger
  manuellement).
- La précondition de l'issue est explicite : si des copies papier doivent être
  scannées pour notation manuelle → **CŒUR**, ne pas retirer.
- Les scans sont aussi la **preuve en cas de réclamation** (litige de note,
  #111) : les supprimer affaiblit le traitement des litiges.
- Retrait prématuré = perte de la **seule trace** des copies papier.

**Si l'on veut vraiment retirer** : d'abord passer la correction des parties 2/3 à
une saisie 100 % numérique (sans support papier), puis retirer dans une issue
dédiée.

**Note** : #149 (P1) déplace le stockage des scans vers un objet store — la
**pérennité** des fichiers est donc traitée séparément du sort de la
fonctionnalité.

**Décision finale attendue de** : pédagogie / responsable d'examen.

---

### #124 — `internshipScore` : composant séparé, hors `finalScore`

**Statut** : issue **fermée** — la recommandation est **déjà appliquée** dans le
code ; il reste à valider les **libellés**.

**Recommandation** : retirer toute illusion de « moyenne composite ».
`internshipScore` **reste un composant séparé** (note de stage) et **n'entre pas**
dans `finalScore`.

**Justification technique**
- Le schéma l'énonce désormais explicitement : `finalScore` = « pourcentage
  examen 0..100 … #124 : `internshipScore` est un composant SÉPARÉ (note de
  stage), il n'entre pas dans `finalScore` ».
- Conséquence cohérente : la **réussite** et la **mention** ne dépendent que de
  l'examen (`finalScore >= Exam.passingScore`, `lib/exams/scoring.ts`), tandis que
  la note de stage alimente `Attestation.stageScore` (`lib/attestations/issue.ts`).
- **À vérifier** : aucun écran/PDF ne doit afficher un libellé du type « moyenne
  globale » combinant examen + stage. Afficher les deux composantes **séparément**
  (score examen / note de stage) avec des libellés distincts.

**Décision finale attendue de** : produit (libellés uniquement).

---

### #69 — CSRF / BotID : CONFIRMER LE RETRAIT

**Recommandation** : confirmer le **retrait** de la sécurité factice CSRF +
BotID.

**Justification technique**
- `lib/csrf.ts` n'est **jamais appelé côté serveur** et le cookie `csrf_token`
  n'est **jamais posé** : le header `x-csrf-token` émis par `lib/api-client.ts`
  n'est validé par **aucune** route. Protection inexistante.
- `BotIdClient` est monté (`app/layout.tsx`) mais **aucun `checkBotId`** n'existe
  côté serveur → protection inactive, pour un coût réel (config, dépendance,
  surface).
- **Une sécurité qui ne protège pas est pire qu'aucune** : elle crée un faux
  sentiment de sécurité et masque le besoin d'une vraie protection.
- Better Auth assure déjà les protections d'origine/CSRF pour **ses propres**
  routes via sa configuration (`trustedOrigins` / `BETTER_AUTH_URL`) : c'est ce
  point-là qu'il faut vérifier, pas un mécanisme maison inerte.

**Conséquence** : supprimer `lib/csrf.ts` et l'envoi `x-csrf-token`
(`lib/api-client.ts`), `BotIdClient` (`app/layout.tsx`), la config `botid`
(`next.config.mjs`) et la dépendance `botid`. Aucune route ne consomme
`x-csrf-token` (vérifié).

**Règle** : si l'on veut un jour CSRF/BotID, l'implémenter **côté serveur avec
tests** — pas d'entre-deux.

**Décision finale attendue de** : sécurité.

---

## 3. Synthèse des suites à créer

Ces suites ne font pas partie de #159 (documentation) :

| Suite | Origine | Priorité proposée |
| --- | --- | --- |
| Nettoyage dark mode (bloc `.dark` + `dark:`) | #83 | P3 |
| Nettoyage docs/liens fantômes (chat, ressources, portfolio, waitlist) | #86 | P3 |
| Retirer CSRF/BotID | #69 | P2 |
| Retirer OTP logs | #74 | P3 |
| Retirer transcript (+ 4 liens) | #94 | P2 — après confirmation référentiel |
| Forcer la 2FA admin (optionnel) | #74 | P3 |
| Libellés « note de stage » séparés | #124 | P3 |

---

## 4. Critères d'acceptation (#159)

- [x] Chaque décision bloquante a une recommandation **argumentée techniquement**.
- [x] Chaque recommandation est postée en commentaire dans son issue d'origine
      (`DÉCISION RECOMMANDÉE : …`) — traçabilité.
- [ ] **Validation humaine** (responsable + date) pour chaque point — reste à faire.
- [ ] Report des décisions validées dans `docs/decisions-bloquantes.md` (mise à
      jour datée) puis déblocage effectif des lots.
