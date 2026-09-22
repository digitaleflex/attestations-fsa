# KPI produit & définition du succès

> Issue : **#158** (M8 — Prérequis production, P10). Document de référence pour
> mesurer si la plateforme remplit sa mission : **inscription formation ·
> candidature stage · passage examen · résultats · certificat + vérification
> publique**.

Ce document est **normatif** : il fixe les définitions, les sources de données et
les cibles. Toute évolution de calcul doit être répercutée ici et datée.

---

## 1. Périmètre & conventions

- **Période** : toutes les requêtes prennent une fenêtre `[:from, :to)` en
  `timestamptz` (UTC de préférence). Le mois calendaire est la maille de
  reporting par défaut.
- **Sources** : modèles Prisma réels (`prisma/schema.prisma`) —
  `User`, `Contact`, `Formation`, `Exam`, `ExamSession`, `Attestation`,
  `InternshipRequest`, `Reclamation`, `CorrectionRequest`, `SecurityLog`,
  `Settings`.
- **Nommage SQL** : Prisma mappe chaque modèle sur une table du **même nom**,
  en CamelCase, donc entre guillemets (`"User"`, `"ExamSession"`, …). Les
  colonnes sont également en CamelCase.
- **Population** : sauf mention contraire, on ne compte que les **candidats**
  (`"User".role = 'user'`), jamais les admins.
- **Statuts d'examen** (`"ExamSession".status`, text) : `PENDING`,
  `IN_PROGRESS`, `COMPLETED` (QCM auto-corrigé), `PENDING_REVIEW` (parties
  manuelles à noter), `GRADED` (correction admin terminée). « Corrigé » =
  `COMPLETED` ou `GRADED` (`lib/exams/scoring.ts::isCorrected`).
- **Réussite** : `"ExamSession".finalScore >= "Exam".passingScore`, car
  `finalScore` est un **pourcentage 0..100** et `passingScore` un **seuil en
  pourcentage** (ex. 65). `"ExamSession".internshipScore` est un composant
  **séparé** (note de stage) : il n'entre pas dans `finalScore` (cf. #124).

### Définition du succès (une phrase)

> Un candidat réel peut **s'inscrire**, **passer son examen**, **consulter son
> résultat**, **télécharger un certificat juste** et **le faire vérifier
> publiquement** — sans perte de copie ni faux résultat.

---

## 2. Entonnoir de référence (funnel)

```
Inscription (lead)      Contact.type = 'FORMATION_INSCRIPTION'
        │
        ▼
Compte candidat         User.role = 'user'
        │
        ▼
Examen démarré          ExamSession.status ∈ {IN_PROGRESS, …}
        │
        ▼
Examen soumis           ExamSession.submittedAt IS NOT NULL
        │
        ▼
Examen corrigé          ExamSession.status ∈ {COMPLETED, GRADED}
        │
        ▼
Réussite                finalScore >= Exam.passingScore
        │
        ▼
Certificat émis         Attestation.status ∈ {VALIDATED, CLAIMED}
        │
        ▼
Vérification publique   /api/verifier (à instrumenter — §5)
```

Le stage (`InternshipRequest`) est un **funnel parallèle** :
`PENDING → REVIEWING → ACCEPTED | REJECTED`.

---

## 3. Catalogue des KPI

### F1 — Taux de conversion inscription → compte
- **Définition** : comptes candidats créés dont l'email correspond à un lead
  d'inscription, divisé par le nombre de leads sur la période.
- **Cible** : **≥ 60 %** (à confirmer métier). Un lead ne crée un compte que
  s'il complète le parcours ; un taux trop bas signale un friction point
  (email OTP, formulaire).

### F2 — Taux de passage d'examen
- **Définition** : candidats ayant démarré ≥ 1 examen / candidats rattachés à
  une formation (`User.formationId IS NOT NULL`).
- **Cible** : **≥ 70 %**.

### F3 — Taux de complétion d'examen (soumission)
- **Définition** : sessions **soumises** / sessions **démarrées**.
- **Cible** : **≥ 85 %**. Sous ce seuil → abandon en cours d'épreuve
  (chrono, bugs de soumission cf. #114).

### F4 — Taux de réussite
- **Définition** : sessions corrigées avec `finalScore >= passingScore` /
  sessions corrigées.
- **Cible** : **60–80 %** (bande, ni trop basse ni suspecte). Un taux > 95 %
  doit déclencher une revue qualité (fausse réussite — cf. #115/#116/#117).

### F5 — Mention correcte (contrôle qualité)
- **Définition** : attestations `CERTIFICATION` dont
  `certificationMention` correspond au barème (`lib/exams/scoring.ts::resolveMention`)
  / attestations `CERTIFICATION` validées.
- **Cible** : **100 %**.

### T1 — Délai moyen d'obtention du certificat
- **Définition** : `Attestation.issuedAt − User.createdAt` (ou
  `Contact.createdAt` du lead lié), en jours, sur les attestations
  `VALIDATED`/`CLAIMED`.
- **Cible** : **≤ 30 jours** entre inscription et certificat.

### T2 — Délai de correction admin
- **Définition** : `gradedAt − submittedAt` sur les sessions `GRADED`.
- **Cible** : **≤ 72 h** (médiane), **≤ 7 j** (P95).

### A1..A4 — Taux d'abandon par étape
- A1 lead → compte non créé (= 100 % − F1).
- A2 compte rattaché à une formation mais sans session (= 100 % − F2).
- A3 session `IN_PROGRESS` non soumise et non mise à jour depuis > 24 h.
- A4 session `PENDING_REVIEW` non corrigée depuis > 72 h.
- **Cible** : A3 **≤ 15 %**, A4 **≤ 10 %** des sessions clôturées.

### S1 — Taux d'acceptation de stage
- **Définition** : `InternshipRequest.status = 'ACCEPTED'` /
  (ACCEPTED + REJECTED) sur la période.
- **Cible** : **≥ 40 %** (dépend des places ; à valider métier).

### S2 — Délai de traitement des candidatures stage
- **Définition** : `updatedAt − createdAt` moyen sur les candidatures
  tranchées (`ACCEPTED`/`REJECTED`).
- **Cible** : **≤ 14 jours**.

### V1 — Usage de la vérification publique
- **Définition** : nombre de vérifications `/api/verifier` par mois (et taux de
  succès, taux de « code introuvable »).
- **Cible** : **≥ 0,5 vérification par certificat et par an** (signal
  d'usage employeur). **Non mesurable aujourd'hui** → instrumentation requise
  (§5).

### Q1..Q3 — Qualité / intégrité
- Q1 : attestations `REJECTED` / attestations émises (révocations).
- Q2 : `Reclamation` ouvertes > 7 j.
- Q3 : `CorrectionRequest` `PENDING` > 7 j.
- **Cible** : Q1 **≤ 2 %**, Q2/Q3 backlog **= 0** au-delà de 7 j.

### Cibles globales existantes
`Settings` porte déjà des objectifs institutionnels :
`targetInscriptions = 500`, `targetValidations = 450`,
`targetAttestations = 300`. Les KPI F1–F4 doivent être lus **contre ces
cibles**, qui restent la source de vérité métier.

---

## 4. Requêtes SQL proposées

> Toutes les requêtes sont en lecture seule. Les exécuter sur une **connexion
> en lecture seule / réplica** en production. Remplacer `:from` / `:to` par des
> `timestamptz`.

### Funnel global

```sql
-- Compteur par étape sur la période
WITH leads AS (
  SELECT COUNT(*)::numeric AS n
  FROM "Contact"
  WHERE type = 'FORMATION_INSCRIPTION'
    AND "createdAt" >= :from AND "createdAt" < :to
),
accounts AS (
  SELECT COUNT(*)::numeric AS n
  FROM "User"
  WHERE role = 'user'
    AND "createdAt" >= :from AND "createdAt" < :to
),
sessions AS (
  SELECT
    COUNT(*)::numeric AS started,
    COUNT(*) FILTER (WHERE "submittedAt" IS NOT NULL)::numeric AS submitted,
    COUNT(*) FILTER (WHERE status IN ('COMPLETED','GRADED'))::numeric AS corrected,
    COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW')::numeric AS pending_review,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::numeric AS in_progress
  FROM "ExamSession"
  WHERE "startedAt" >= :from AND "startedAt" < :to
),
attestations AS (
  SELECT COUNT(DISTINCT id)::numeric AS n
  FROM "Attestation"
  WHERE status IN ('VALIDATED','CLAIMED')
    AND "issuedAt" >= :from AND "issuedAt" < :to
)
SELECT
  (SELECT n FROM leads)         AS leads,
  (SELECT n FROM accounts)      AS comptes,
  (SELECT started FROM sessions) AS sessions_demarrees,
  (SELECT submitted FROM sessions) AS sessions_soumises,
  (SELECT corrected FROM sessions) AS sessions_corrigees,
  (SELECT pending_review FROM sessions) AS en_attente_correction,
  (SELECT in_progress FROM sessions) AS en_cours,
  (SELECT n FROM attestations)  AS certificats_emis;
```

### F1 — Conversion lead → compte (jointure par email)

```sql
WITH leads AS (
  SELECT DISTINCT lower(email) AS email
  FROM "Contact"
  WHERE type = 'FORMATION_INSCRIPTION'
    AND "createdAt" >= :from AND "createdAt" < :to
)
SELECT
  COUNT(*)::numeric AS leads,
  COUNT(*) FILTER (WHERE u.id IS NOT NULL)::numeric AS convertis,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE u.id IS NOT NULL) / NULLIF(COUNT(*), 0), 1
  ) AS taux_conversion_pct
FROM leads l
LEFT JOIN "User" u
  ON u.role = 'user' AND lower(u.email) = l.email;
```

### F4 — Taux de réussite (scoring canonique)

```sql
SELECT
  COUNT(*)::numeric AS corrigees,
  COUNT(*) FILTER (WHERE s."finalScore" >= e."passingScore")::numeric AS reussies,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE s."finalScore" >= e."passingScore")
    / NULLIF(COUNT(*), 0), 1
  ) AS taux_reussite_pct,
  ROUND(AVG(s."finalScore")::numeric, 2) AS score_moyen
FROM "ExamSession" s
JOIN "Exam" e ON e.id = s."examId"
WHERE s.status IN ('COMPLETED','GRADED')
  AND s."gradedAt" >= :from AND s."gradedAt" < :to;
```

### T1 — Délai moyen inscription → certificat

```sql
SELECT
  ROUND(AVG(EXTRACT(EPOCH FROM (a."issuedAt" - u."createdAt")) / 86400), 1)
    AS delai_moyen_jours,
  ROUND(
    PERCENTILE_CONT(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (a."issuedAt" - u."createdAt")) / 86400
    )::numeric, 1
  ) AS delai_p95_jours
FROM "Attestation" a
JOIN "User" u ON u.id = a."userId"
WHERE a.status IN ('VALIDATED','CLAIMED')
  AND a."issuedAt" >= :from AND a."issuedAt" < :to;
```

### A3/A4 — Abandons détectables

```sql
-- A3 : sessions en cours, non touchées depuis > 24 h
SELECT COUNT(*) AS abandons_en_cours
FROM "ExamSession"
WHERE status = 'IN_PROGRESS'
  AND "updatedAt" < now() - interval '24 hours';

-- A4 : corrections en retard > 72 h
SELECT COUNT(*) AS corrections_en_retard
FROM "ExamSession"
WHERE status = 'PENDING_REVIEW'
  AND "submittedAt" < now() - interval '72 hours'
  AND "submittedAt" >= :from AND "submittedAt" < :to;
```

### S1/S2 — Stages

```sql
SELECT
  COUNT(*)::numeric AS candidatures,
  COUNT(*) FILTER (WHERE status = 'ACCEPTED')::numeric AS acceptees,
  COUNT(*) FILTER (WHERE status = 'REJECTED')::numeric AS refusees,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'ACCEPTED')
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('ACCEPTED','REJECTED')), 0), 1
  ) AS taux_acceptation_pct,
  ROUND(
    AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400)
      FILTER (WHERE status IN ('ACCEPTED','REJECTED'))::numeric, 1
  ) AS delai_moyen_jours
FROM "InternshipRequest"
WHERE "createdAt" >= :from AND "createdAt" < :to;
```

### Q1/Q2/Q3 — Qualité

```sql
SELECT
  (SELECT COUNT(*) FROM "Attestation"
     WHERE status = 'REJECTED'
       AND "issuedAt" >= :from AND "issuedAt" < :to) AS certificats_revoques,
  (SELECT COUNT(*) FROM "Reclamation"
     WHERE status = 'PENDING'
       AND "createdAt" < now() - interval '7 days') AS reclamations_en_retard,
  (SELECT COUNT(*) FROM "CorrectionRequest"
     WHERE status = 'PENDING'
       AND "createdAt" < now() - interval '7 days') AS corrections_utilisateur_en_retard;
```

> **Rappel** : `Settings.targetInscriptions`, `targetValidations` et
> `targetAttestations` alimentent déjà `/api/public/stats`. Le tableau de bord
> interne doit réutiliser ces cibles, pas en créer de nouvelles.

---

## 5. Instrumentation manquante — V1 (vérification publique)

Aujourd'hui `/api/verifier` **ne journalise pas** les appels : impossible de
compter l'usage côté employeurs. Deux options, à trancher hors de cette issue
de documentation :

1. **Recommandé** — écrire une ligne `SecurityLog` par appel :
   `eventType = 'PUBLIC_VERIFICATION'`, `status = 'SUCCESS' | 'NOT_FOUND'`,
   `severity = 'info'`, `ipAddress` tronquée/ignorée (RGPD), `resourceId = id`
   d'attestation si trouvée. Modèle déjà présent, aucune migration.
2. Si l'on veut un vrai KPI analytics, une table dédiée `VerificationEvent`
   (à créer) avec index `[timestamp]`.

Requête cible une fois instrumenté :

```sql
SELECT
  COUNT(*) AS verifications,
  COUNT(*) FILTER (WHERE status = 'SUCCESS') AS succes,
  COUNT(DISTINCT "resourceId") AS certificats_distincts
FROM "SecurityLog"
WHERE "eventType" = 'PUBLIC_VERIFICATION'
  AND "timestamp" >= :from AND "timestamp" < :to;
```

**Décision requise** : ajouter l'écriture `SecurityLog` relève d'une issue de
code (hors #158). À créer une fois #158 validée.

---

## 6. Tableau de bord proposé

### Backend
- `GET /api/admin/kpis?from=&to=` (admin only, `requireAdmin`) retourne le
  JSON des sections §4 en **Prisma** (équivalent fonctionnel des requêtes
  ci-dessus), avec `Cache-Control: private, max-age=300`.
- Pour l'export/BI, exposer les **requêtes SQL de référence** de ce document
  (même définitions, sinon divergence garantie).

### Frontend
- Page `/admin/kpis` (niveau M8, hors #158) :
  - bandeau funnel F1→certificat (barres + taux de conversion entre étapes) ;
  - cartes F2/F3/F4/T1/T2 avec seuils colorés (vert = cible atteinte) ;
  - liste des goulots : A3 (abandons), A4 (corrections en retard) ;
  - bloc stages S1/S2 ;
  - bloc qualité Q1–Q3 ;
  - sélecteur de période (30 j / trimestre / année).
- **Réutiliser** `/api/public/stats` pour le public (déjà en place), ne pas
  exposer les KPI internes publiquement.

### Cadence & responsabilité
- **Hebdomadaire** : revue A3/A4 (opérationnel).
- **Mensuelle** : revue F1–F4, T1, S1, V1 (pilotage).
- **Trimestrielle** : revue des cibles (métier + direction).
- Responsable désigné à nommer (Direction FSA) ; les cibles chiffrées de ce
  document sont des **propositions à valider métier**.

---

## 7. Critères d'acceptation (issue #158)

- [x] Définitions écrites pour : inscription→examen→certificat, taux de
  réussite, abandon par étape, stages, usage vérification publique.
- [x] Requêtes SQL fournies, alignées sur les modèles Prisma réels
  (`User`, `ExamSession`, `Attestation`, `InternshipRequest`, `Contact`).
- [x] Cibles chiffrées proposées, rattachées aux `Settings` existants.
- [x] Tableau de bord proposé (API + page admin).
- [ ] **Validation métier des cibles** (direction FSA) — reste à faire.
- [ ] **Créer l'issue d'instrumentation V1** (`SecurityLog`) — reste à faire.

---

## 8. Hors périmètre

- Implémentation de la page `/admin/kpis` et de l'endpoint associé.
- Instrumentation de `/api/verifier` (issue de code dédiée).
- Refonte de `/api/public/stats`.
