# Système Anti-Triche - Documentation Complète

## Vue d'ensemble

Ce document décrit l'ensemble des systèmes anti-triche implémentés dans la plateforme FSA pour protéger l'intégrité des examens et des attestations.

---

## ✅ Systèmes Implémentés

### 1. Protection CSRF (Cross-Site Request Forgery)

> **Correction documentaire.** Cette section décrivait un jeton anti-CSRF
> (`lib/csrf.ts`, tokens `crypto.getRandomValues()`, cookie `SameSite=strict`).
> **Ce composant n'a jamais existé dans ce dépôt** : ni `lib/csrf.ts`, ni
> route `/api/csrf-token`, ni en-tête `x-csrf-token`. La description ci-dessous
> est l'état réel.

**Statut:** ✅ ACTIVÉ — **par contrôle d'origine, pas par jeton**  
**Fichiers:**
- `lib/auth.ts` (allowlist `trustedOrigins`, `resolveTrustedOrigins()`)
- `app/api/auth/[...all]/route.ts` (routeur Better Auth qui applique le contrôle)

**Fonctionnement:**
- **Aucun jeton n'est généré ni exigé.** La page cookies publique et
  `docs/SECURITY_FIX_GUIDE.md` (§2.5) décrivent le même dispositif.
- Le routeur Better Auth compare l'en-tête `Origin` (à défaut `Referer`) à
  l'allowlist `trustedOrigins` et refuse la requête (`403`) si l'origine est
  absente, vaut `null`, ou n'est pas dans la liste.
- **Étendue réelle :** routes `/api/auth/*`, **méthodes de mutation
  uniquement** (`GET`/`HEAD`/`OPTIONS` sortent avant le contrôle), et
  **seulement si la requête porte déjà des cookies**. Une requête sans cookie
  n'est pas bloquée.
- En complément, l'attribut `SameSite=Lax` du cookie de session empêche le
  navigateur d'y joindre des cookies depuis un autre site (hors navigation de
  premier niveau vers la Plateforme).

**Limite assumée — à lire avant d'écrire « protégé » :**
- Les routes applicatives **hors `/api/auth`** (`/api/user`, `/api/admin`,
  `/api/exams`, …) ne passent par **aucun** contrôle d'origine. Elles reposent
  sur `SameSite=Lax`, la validation de session de `lib/api-auth` et le rate
  limiting.
- `SameSite=Lax` n'interdit pas une requête *same-site* issue d'un sous-domaine
  compromis.
- `disableOriginCheck` / `disableCSRFCheck` désactiveraient le contrôle ;
  `lib/auth.ts` ne les pose pas.

**Protection réelle contre:**
- Requêtes cross-site authentifiées adressées à `/api/auth/*` depuis une origine
  non approuvée
- Attaques par injection de formulaires sur les mêmes routes

**Endpoints concernés:**
- `/api/auth/*` uniquement (pas « toutes les routes protégées »)

---

### 2. Rate Limiting Par Utilisateur

**Statut:** ✅ IMPLÉMENTÉ  
**Fichiers:**
- `lib/rate-limit.ts` (fonction `applyRateLimitByUser`)
- `app/api/exams/[id]/submit/route.ts`

**Fonctionnement:**
- Double vérification: IP **ET** userId
- L'utilisateur est bloqué si **l'une** des limites est atteinte
- Empêche le contournement avec des IPs multiples

**Limites actives:**

| Type | Limite | Fenêtre |
|------|--------|---------|
| Login | 5 tentatives | 15 min |
| Register | 3 inscriptions | 1 heure |
| Submission | 5 submissions | 1 heure |
| Verify | 10 vérifications | 1 heure |
| Report | 3 signalements | 1 heure |

**Protection contre:**
- Contournement de rate limit via VPN/proxy
- Brute-force avec IPs rotatives
- Spam automatisé

---

### 3. Détection de Soumission Trop Rapide

**Statut:** ✅ IMPLÉMENTÉ  
**Fichier:** `app/api/exams/[id]/submit/route.ts`

**Fonctionnement:**
- Capture le timestamp `startedAt` envoyé par le client
- Calcule le temps réel passé sur l'examen
- Seuil minimum: **30 secondes** (suspect si plus rapide)

**Actions en cas de détection:**
1. Rejet de la soumission avec code `SUSPICIOUS_TIMING`
2. Log automatique dans `SecurityLog` avec sévérité `HIGH`
3. Marquage pour vérification manuelle par l'admin

**Données enregistrées:**
```typescript
{
  eventType: 'SUSPICIOUS_ACTIVITY',
  action: 'SUBMISSION_TOO_FAST',
  severity: 'HIGH',
  details: {
    elapsedSeconds,
    examId,
    answerCount
  }
}
```

**Protection contre:**
- Bots de soumission automatique
- Injection de réponses pré-calculées
- Exploits de rapidité impossible

---

### 4. Analyse de Patterns de Réponses

**Statut:** ✅ IMPLÉMENTÉ  
**Fichier:** `lib/anti-cheat.ts`

**Fonctionnement:**
Compare les réponses d'un utilisateur avec **toutes les autres submissions** du même examen.

**Détections implémentées:**

#### a) Réponses 100% Identiques
- Détecte si un utilisateur a **exactement les mêmes réponses** qu'un autre
- Seuil: correspondance parfaite sur toutes les questions
- Sévérité: `CRITICAL`

#### b) Similarité Élevée (>90%)
- Calcule la similarité Jaccard entre les réponses
- Détecte les copies partielles (quelques modifications)
- Sévérité: `HIGH`

#### c) Anomalies Statistiques
- Surveille les submissions avec un nombre inhabituel de réponses
- Aide à détecter les patterns suspects

**Algorithme de similarité:**
```typescript
similarite = réponses_correspondantes / questions_communes
```

**Actions en cas de détection:**
1. Submission acceptée mais **flaggée** (`scorePart2 = -1`)
2. Log dans `SecurityLog` avec type `CHEATING_DETECTED`
3. Notification à l'admin pour investigation

**Protection contre:**
- Copie entre candidats
- Fuite de réponses
- Collaboration non autorisée

---

### 5. Watermarking d'Attestations

**Statut:** ✅ IMPLÉMENTÉ  
**Fichiers:**
- `components/AttestationWatermark.tsx` (nouveau)
- `components/OfficialDocument.tsx` (intégré)

**Fonctionnement:**
Triple couche de protection:

#### a) Filigrane Visible (subtil)
- Pattern diagonal avec opacité 3%
- Code de vérification visible en bas du document
- Exemple: `Réf: ABC123 | FP: x7k9m2`

#### b) Pixels de Vérification (quasi-invisibles)
- 3 pixels de 1x1 positionnés aux coins
- Encodage des données dans la couleur RGB
- Détectables uniquement par analyse du code source

#### c) Fingerprint Cryptographique
- Hash unique généré à partir de:
  - `attestationId`
  - `userId`
  - `code`
  - `generatedAt`
- Permet la vérification server-side

**Fonction de vérification:**
```typescript
verifyWatermark({
  fingerprint,
  attestationId,
  userId,
  code,
  generatedAt
}) // Retourne { valid: boolean, reason? }
```

**Protection contre:**
- Falsification de documents
- Copie non autorisée
- Modification frauduleuse

---

### 6. Détection de Changement d'Onglet

**Statut:** ✅ IMPLÉMENTÉ  
**Fichiers:**
- `lib/useExamMonitoring.ts` (nouveau)
- `app/api/exams/monitoring/route.ts` (nouveau)
- `app/(user)/exams/[id]/page.tsx` (intégré)

**Fonctionnement:**
Surveillance en temps réel du comportement de l'utilisateur pendant l'examen.

#### a) Changements d'Onglet (Visibility API)
- Détecte quand l'utilisateur quitte l'onglet de l'examen
- Utilise `document.visibilityState` et l'événement `visibilitychange`
- Compte le nombre de changements d'onglet

#### b) Perte de Focus (Blur Detection)
- Détecte quand l'utilisateur clique hors du navigateur
- Surveille les événements `window.blur` et `window.focus`
- Enregistre les timestamps de chaque incident

#### c) Détection de Multi-Onglets
- Utilise `localStorage` pour détecter si plusieurs onglets sont ouverts
- Empêche la collaboration entre onglets
- Alerte immédiate si un deuxième onglet est détecté

#### d) Avertissement Avant Quitter
- Intercepte `beforeunload` pour afficher une confirmation
- Empêche les fermetures accidentelles de page
- Message: "Vous êtes en plein examen. Êtes-vous sûr?"

**Seuils d'alerte:**

| Événement | Seuil Warning | Seuil Critical |
|-----------|---------------|----------------|
| Changements d'onglet | 3 | 5 |
| Pertes de focus | 6 | 10 |
| Multi-onglets | 1 | 2 |

**Actions en cas de détection:**

1. **Warning Utilisateur** (dès 3 incidents)
   - Toast notification: "⚠️ Attention: Vous avez quitté l'examen X fois"
   - Banner visible dans le header avec compteur

2. **Log Automatique** (tous les incidents)
   - Envoi à `/api/exams/monitoring` lors de la submission
   - Stockage dans `SecurityLog` avec type `EXAM_MONITORING`

3. **Flag Session** (seuil critical)
   - `scorePart3 = -1` pour marquer la session
   - Notification admin pour investigation

**Données enregistrées:**
```typescript
{
  eventType: 'EXAM_MONITORING',
  action: 'SUSPICIOUS_BEHAVIOR',
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  details: {
    totalEvents,
    suspiciousEvents,
    tabSwitches,
    multipleWindows,
    events: [
      { type, timestamp, details }
    ]
  }
}
```

**Protection contre:**
- Consultation de notes/papiers pendant l'examen
- Recherche sur Internet
- Communication avec d'autres candidats
- Utilisation d'IA ou d'outils externes

---

## 📊 Monitoring & Audit

### SecurityLog Database

Toutes les détections sont enregistrées dans la table `SecurityLog`:

| Champ | Description |
|-------|-------------|
| `eventType` | Type d'événement (CHEATING_DETECTED, SUSPICIOUS_ACTIVITY) |
| `userId` | Utilisateur concerné |
| `ipAddress` | IP de la requête |
| `userAgent` | Navigateur/client |
| `action` | Action détectée |
| `severity` | LOW / MEDIUM / HIGH / CRITICAL |
| `details` | Données JSON complètes |

### Requêtes Admin

**Voir toutes les détections de triche pour un examen:**
```typescript
import { getFlaggedSubmissions } from '@/lib/anti-cheat';
const flagged = await getFlaggedSubmissions(examId);
```

**Voir tous les logs de sécurité:**
```typescript
const logs = await prisma.securityLog.findMany({
  where: { eventType: 'CHEATING_DETECTED' },
  include: { user: true },
  orderBy: { timestamp: 'desc' }
});
```

---

## 🔄 Flux Complet Anti-Triche

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UTILISATEUR DÉMARRE L'EXAMEN                             │
│    → Session créée avec timestamp                           │
│    → Surveillance activée (tab, focus, multi-onglets)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. PENDANT L'EXAMEN (SURVEILLANCE ACTIVE)                   │
│    → Détection changements d'onglet                         │
│    → Détection pertes de focus                              │
│    → Détection multi-onglets                                │
│    → Avertissement si > 3 incidents                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SOUMISSION DES RÉPONSES                                  │
│    → Rate limiting par IP + userId                          │
│    → Vérification du temps écoulé (min 30s)                 │
│    → Envoi des événements de monitoring au serveur          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ANALYSE DE PATTERNS (asynchrone)                         │
│    → Comparaison avec autres submissions                    │
│    → Détection de similarité >90%                           │
│    → Détection de copies identiques                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. SI SUSPICION                                             │
│    → Log dans SecurityLog                                   │
│    → Session flaggée (scorePart2 = -1)                      │
│    → Notification admin                                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. GÉNÉRATION ATTESTATION                                   │
│    → Watermark visible + invisible                          │
│    → Fingerprint cryptographique                            │
│    → Code de vérification unique                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Améliorations Futures Possibles

### Non Implémentées (optionnelles)

| Système | Complexité | Description |
|---------|------------|-------------|
| **CAPTCHA** | Low | Vérification humaine avant submission |
| **Blockchain** | High | Certification immuable des attestations |
| **Machine Learning** | Very High | Modèles prédictifs de triche |

---

## 📝 Notes d'Implémentation

### Performance

- **Rate Limiting:** Utilise Upstash Redis (externalisé, non bloquant)
- **Analyse de patterns:** Asynchrone, n'affecte pas le temps de réponse
- **Watermarking:** Côté client, génération instantanée

### Sécurité

- **CSRF:** Pas de jeton. Contrôle d'origine (`Origin` vs `trustedOrigins`) sur
  `/api/auth/*` en mutation, et `SameSite=Lax` sur le cookie de session. Les
  routes hors `/api/auth` ne sont pas couvertes par ce contrôle.
- **Fingerprints:** Hash 32-bit, suffisant pour la détection
- **Rate Limits:** Sliding window (plus précis que fixed window)

### Évolutivité

- Système conçu pour **50+ utilisateurs simultanés**
- Cache d'idempotence pour les submissions duplicates
- Logs structurés pour analyse future

---

## 🛠️ Maintenance

### Vérifier les détections

```bash
# Via Prisma Studio
npx prisma studio

# Ou via API (à créer)
GET /api/admin/security-logs?eventType=CHEATING_DETECTED
```

### Ajuster les seuils

**Temps minimum d'examen:**
```typescript
// lib/exams/[id]/submit/route.ts, ligne ~58
if (elapsedSeconds < 30) { // Modifier 30 selon besoin
```

**Similarité suspecte:**
```typescript
// lib/anti-cheat.ts, ligne ~97
if (similarity > 0.9) { // Modifier 0.9 selon besoin
```

---

## 📞 Support

Pour toute question sur le système anti-triche:
1. Consulter les logs dans `SecurityLog`
2. Vérifier les flags sur les sessions (`scorePart2 = -1`)
3. Contacter l'équipe technique

---

**Dernière mise à jour:** 4 avril 2026  
**Version:** 1.0.0  
**Auteur:** Système FSA
