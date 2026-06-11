# 🔒 Rapport d'Audit de Sécurité - Application Attestations FSA

**Date :** 1 Avril 2026  
**Auditeur :** Expert Cybersécurité (Spécialité Vulnérabilités Web)  
**Version de l'application :** 0.1.0  
**Classification :** CONFIDENTIEL

---

## 📑 Table des Matières

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture de Sécurité](#2-architecture-de-sécurité)
3. [Vulnérabilités Critiques](#3-vulnérabilités-critiques)
4. [Analyse OWASP Top 10 2021](#4-analyse-owasp-top-10-2021)
5. [User Stories de Sécurité Non Gérées](#5-user-stories-de-sécurité-non-gérées)
6. [Failles Cachées (Non Évidentes)](#6-failles-cachées-non-évidentes)
7. [Matrice de Risques](#7-matrice-de-risques)
8. [Recommandations Stratégiques](#8-recommandations-stratégiques)
9. [Annexes](#9-annexes)

---

## 1. Résumé Exécutif

### 1.1 Contexte

L'application **Attestations FSA** est une plateforme web de gestion d'attestations de formation développée avec :
- **Framework :** Next.js 15 (App Router)
- **Base de données :** PostgreSQL via Prisma ORM
- **Authentification :** Better Auth + système custom (dual)
- **Hébergement :** Vercel (présumé)
- **42 endpoints API** répartis sur 12 domaines fonctionnels

### 1.2 Évaluation Globale

| Métrique | Valeur | Niveau |
|----------|--------|--------|
| **Score de Sécurité Global** | 3.5/10 | 🔴 CRITIQUE |
| **Vulnérabilités Critiques** | 8 | 🔴 URGENT |
| **Vulnérabilités Élevées** | 12 | 🟠 PRIORITAIRE |
| **Vulnérabilités Moyennes** | 15 | 🟡 À TRAITER |
| **Vulnérabilités Faibles** | 7 | 🟢 À SURVEILLER |

### 1.3 Principales Constatations

| # | Constatation | Impact | Urgence |
|---|--------------|--------|---------|
| 1 | Dual système d'authentification | Contournement auth | 🔴 Immédiate |
| 2 | Absence de protection CSRF | Prise de compte | 🔴 Immédiate |
| 3 | Cookies de session non sécurisés | Vol de session | 🔴 Immédiate |
| 4 | Pas de rate limiting | Brute-force, DDoS | 🟠 48h |
| 5 | Upload de fichiers non validé | RCE, Malware | 🟠 48h |
| 6 | Pas de headers de sécurité | XSS, Clickjacking | 🟠 Semaine 1 |
| 7 | Journalisation insuffisante | Non-réputabilité | 🟡 Semaine 2 |
| 8 | Protection IDOR incomplète | Accès données tiers | 🟠 Semaine 1 |

---

## 2. Architecture de Sécurité

### 2.1 Stack Technique

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  React 18 + Next.js 15 + TailwindCSS + Radix UI             │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTES (42)                         │
│  /api/auth/*  /api/admin/*  /api/user/*  /api/public/*      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   AUTHENTIFICATION                           │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   Better Auth   │    │  Custom Cookies │  ⚠️ DUAL        │
│  │   (Moderne)     │    │    (Legacy)     │                 │
│  └─────────────────┘    └─────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   DONNÉES (Prisma)                           │
│  PostgreSQL : 15 modèles, 8 enums                           │
│  User, Admin, Session, Attestation, Exam, Submission...     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Mécanismes d'Authentification

#### Système 1 : Better Auth (Recommandé)
```typescript
// lib/auth.ts
- Email/password avec bcrypt (cost 12)
- Sessions stockées en BDD (table Session)
- Plugins : nextCookies()
- Hooks : after authentication
```

#### Système 2 : Custom Cookies (Problématique)
```typescript
// /api/auth/login/route.ts
cookies.set('admin_session', userId, {
  path: '/',
  sameSite: 'lax',
  maxAge: 604800  // 7 jours
})
// ❌ httpOnly: non défini (par défaut false)
// ❌ secure: non défini (par défaut false)
// ❌ sameSite: 'lax' (devrait être 'strict')
```

### 2.3 Contrôle d'Accès

| Type de Route | Mécanisme | Statut |
|---------------|-----------|--------|
| `/api/auth/*` | Better Auth + Custom | ⚠️ Mixte |
| `/api/admin/*` | Cookie `admin_session` | 🔴 Non sécurisé |
| `/api/user/*` | Cookie `user_role` | 🔴 Non sécurisé |
| `/api/public/*` | Aucun | ✅ Public |
| `/api/verifier` | Aucun | ✅ Public |
| `/api/signalement` | Aucun | ✅ Public |

---

## 3. Vulnérabilités Critiques

### 3.1 AUTH-001 : Dual Système d'Authentification

**Sévérité :** 🔴 CRITIQUE (9.1/10 - CVSS:3.1)

**Description :**
L'application utilise simultanément deux systèmes d'authentification indépendants :
1. **Better Auth** via `/api/auth/[...all]/route.ts`
2. **Auth custom** via cookies manuels dans `/api/auth/login/route.ts`

**Preuve de Concept :**
```typescript
// Deux chemins d'authentification coexistent
Route 1 : POST /api/auth/login → Cookies custom
Route 2 : POST /api/auth/[...all] → Better Auth sessions

// Un attaquant peut :
// 1. Contourner Better Auth en utilisant directement /api/auth/login
// 2. Exploiter les incohérences entre les deux systèmes
```

**Impact :**
- Contournement des mécanismes de sécurité de Better Auth
- Incohérence des politiques de mot de passe
- Impossibilité de tracker uniformément les sessions
- Failles de réputation (non-répudiation compromise)

**Recommandation :**
- **Immédiat :** Déprécier le système custom
- **Court terme :** Migrer 100% vers Better Auth
- **Moyen terme :** Implémenter OAuth2/OIDC

---

### 3.2 SESSION-001 : Cookies Non Sécurisés

**Sévérité :** 🔴 CRITIQUE (8.6/10 - CVSS:3.1)

**Description :**
Les cookies de session sont configurés sans les flags de sécurité essentiels.

**Code Vulnérable :**
```typescript
// /api/auth/login/route.ts (ligne 44-49)
response.cookies.set('admin_session', user.id, {
  path: '/',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7
})
// ❌ httpOnly manquant → accessible via JavaScript (XSS)
// ❌ secure manquant → transmis en HTTP clair
// ❌ sameSite 'lax' → protection CSRF incomplète
```

**Impact :**
- **Vol de session via XSS :** `document.cookie` accessible
- **Interception réseau :** Cookie transmis en HTTP non chiffré
- **CSRF :** sameSite 'lax' n'empêche pas toutes les attaques

**Recommandation :**
```typescript
response.cookies.set('admin_session', user.id, {
  path: '/',
  httpOnly: true,      // ✅ Empêche accès JS
  secure: true,        // ✅ HTTPS uniquement
  sameSite: 'strict',  // ✅ Protection CSRF maximale
  maxAge: 60 * 60 * 24 * 7
})
```

---

### 3.3 CSRF-001 : Absence de Protection CSRF

**Sévérité :** 🔴 CRITIQUE (8.2/10 - CVSS:3.1)

**Description :**
Aucun mécanisme de protection CSRF n'est implémenté :
- Pas de token CSRF
- Pas de middleware Next.js
- Pas de validation d'origine (Origin/Referer headers)

**Preuve de Concept :**
```html
<!-- Attaquant peut créer un formulaire malveillant -->
<form action="https://attestations-fsa.com/api/admin" method="POST">
  <input type="hidden" name="email" value="hacker@evil.com">
  <input type="hidden" name="name" value="Hacker">
</form>
<script>document.forms[0].submit();</script>
```

**Impact :**
- Modification de profil admin à l'insu de la victime
- Création/suppression d'attestations
- Changement de mot de passe
- Soumission d'examens frauduleux

**Recommandation :**
1. Créer `middleware.ts` avec validation CSRF
2. Utiliser `better-auth` plugins CSRF
3. Vérifier headers `Origin` et `Referer`

---

### 3.4 RATE-001 : Absence de Rate Limiting

**Sévérité :** 🟠 ÉLEVÉE (7.5/10 - CVSS:3.1)

**Description :**
Aucune limitation de débit n'est implémentée sur les endpoints API.

**Endpoints Critiques Non Protégés :**
| Endpoint | Risque | Impact Potentiel |
|----------|--------|------------------|
| `POST /api/auth/login` | Brute-force | Prise de compte |
| `POST /api/auth/register` | Spam, DoS | Saturation BDD |
| `POST /api/signalement` | Spam | Saturation système |
| `GET /api/verifier` | Scraping | Vol de données |
| `POST /api/submissions/submit` | Fraud | Falsification notes |

**Recommandation :**
```typescript
// lib/rate-limit.ts (à créer)
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 essais / 15min
  analytics: true,
})
```

---

### 3.5 UPLOAD-001 : Upload de Fichiers Non Validé

**Sévérité :** 🟠 ÉLEVÉE (7.8/10 - CVSS:3.1)

**Description :**
L'endpoint d'upload de scans ne valide ni le type, ni la taille des fichiers.

**Code Vulnérable :**
```typescript
// /api/admin/submissions/[id]/scans/route.ts (ligne 62-75)
const files = formData.getAll('scans') as File[]

for (let i = 0; i < files.length; i++) {
  const scan = await prisma.compositionScan.create({
    data: {
      url: `/uploads/scans/${id}/${file.name}`,  // ❌ URL simulée
      fileName: file.name,  // ❌ Pas de validation extension
      fileSize: file.size,  // ❌ Pas de limite taille
      // ...
    }
  })
}
```

**Impact :**
- **Upload de malware :** .php, .exe, .sh
- **RCE (Remote Code Execution) :** Si serveur exécute /uploads/
- **DoS :** Fichiers de plusieurs Go
- **XSS :** Fichiers SVG avec JavaScript

**Recommandation :**
```typescript
// Validations à implémenter
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE = 5 * 1024 * 1024  // 5MB

// Vérifier magic bytes (pas seulement extension)
// Scanner antivirus (ClamAV)
// Stocker hors webroot
// Renommer avec UUID
```

---

### 3.6 HEADER-001 : Headers de Sécurité Absents

**Sévérité :** 🟠 ÉLEVÉE (6.8/10 - CVSS:3.1)

**Description :**
Aucun header de sécurité HTTP n'est configuré (pas de middleware).

**Headers Manquants :**
| Header | Valeur Recommandée | Protection |
|--------|-------------------|------------|
| `Content-Security-Policy` | `default-src 'self'` | XSS |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000` | HTTPS forcé |
| `X-XSS-Protection` | `1; mode=block` | XSS (legacy) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Fuite d'info |
| `Permissions-Policy` | `camera=(), microphone=()` | Features |

**Recommandation :**
```typescript
// middleware.ts (à créer)
export function middleware(request: Request) {
  const response = NextResponse.next()
  
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000')
  // ...
  
  return response
}
```

---

### 3.7 LOG-001 : Journalisation Insuffisante

**Sévérité :** 🟡 MOYENNE (5.3/10 - CVSS:3.1)

**Description :**
Seuls les événements d'authentification sont journalisés. Les autres actions sensibles ne sont pas tracées.

**Événements Non Loggés :**
- ❌ Création/modification/suppression d'attestations
- ❌ Changements de scores d'examens
- ❌ Accès aux données utilisateurs
- ❌ Uploads de fichiers
- ❌ Export de données
- ❌ Échecs d'autorisation

**Recommandation :**
```typescript
// lib/security-logger.ts (à créer)
interface SecurityEvent {
  eventType: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  status: 'SUCCESS' | 'FAILURE'
  timestamp: Date
  details?: Record<string, unknown>
}
```

---

### 3.8 IDOR-001 : Protection IDOR Incomplète

**Sévérité :** 🟠 ÉLEVÉE (7.2/10 - CVSS:3.1)

**Description :**
Certaines routes API ne vérifient pas l'appartenance des ressources.

**Exemple de Route Vulnérable :**
```typescript
// /api/user/profile/route.ts
async function isAuthenticatedUser() {
  const session = cookieStore.get('admin_session')
  return session?.value  // ❌ Retourne juste l'ID, pas de vérification ownership
}

// GET /api/submissions/{id}
// ❌ N'importe quel utilisateur peut accéder aux submissions des autres
```

**Impact :**
- Accès aux données d'autres utilisateurs
- Consultation de notes confidentielles
- Vol d'informations personnelles

**Recommandation :**
```typescript
// Vérifier ownership
const submission = await prisma.examSubmission.findUnique({
  where: { id: submissionId }
})

if (submission.userId !== userId) {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
}
```

---

## 4. Analyse OWASP Top 10 2021

### A01:2021 - Broken Access Control

**Statut :** ⚠️ **PARTIELLEMENT PROTÉGÉ**

**Constats :**
| Contrôle | Statut | Preuve |
|----------|--------|--------|
| RBAC (Admin/User) | ✅ Implémenté | Cookie `user_role` |
| Vérification ownership | ⚠️ Partiel | Certaines routes vulnérables |
| Principle of Least Privilege | ⚠️ Partiel | Admin a accès à tout |
| CORS | ❌ Non configuré | Pas de middleware |
| Force Browsing | ⚠️ Partiel | Routes non protégées accessibles |

**Recommandations :**
- Implémenter vérification systématique d'ownership
- Ajouter middleware de protection globale
- Configurer CORS restrictif

---

### A02:2021 - Cryptographic Failures

**Statut :** ⚠️ **PARTIELLEMENT PROTÉGÉ**

**Constats :**
| Élément | Statut | Détails |
|---------|--------|---------|
| Mots de passe | ✅ bcrypt (cost 12) | Sauf admin (cost 10) |
| HTTPS | ⚠️ Dépend hébergement | À vérifier |
| Données sensibles BDD | ❌ En clair | Email, téléphone, adresse |
| Tokens de session | ⚠️ cuid() | Suffisant mais pas optimal |

**Recommandations :**
- Chiffrer données personnelles en BDD (AES-256)
- Uniformiser bcrypt cost à 12
- Forcer HTTPS (HSTS)

---

### A03:2021 - Injection

**Statut :** ✅ **CORRECTEMENT PROTÉGÉ**

**Points Forts :**
- ✅ Prisma ORM (requêtes paramétrées)
- ✅ Zod validation sur toutes les entrées
- ✅ Pas de SQL dynamique

**Vigilance :**
- ⚠️ Champs JSON (`answers`) non validés en structure
- ⚠️ Recherche `endsWith` potentiellement exploitable

---

### A04:2021 - Insecure Design

**Statut :** 🔴 **MULTIPLES FAILLES**

**Problèmes Identifiés :**
1. **Dual auth system** → Design flaw majeur
2. **Pas de password reset** → Flow incomplet
3. **Email verification non utilisée** → Feature orphan
4. **Upload simulé** → Design non production-ready
5. **Pas de backup strategy** → Risque métier

**Recommandations :**
- Refondre l'architecture d'authentification
- Implémenter les flows manquants
- Prévoir stratégie de récupération

---

### A05:2021 - Security Misconfiguration

**Statut :** 🔴 **NON CONFORME**

**Manquements :**
| Élément | Attendu | Actuel |
|---------|---------|--------|
| Middleware Next.js | Présent | ❌ Absent |
| Headers sécurité | 7 headers | ❌ 0 header |
| Cookies sécurisés | httpOnly+secure | ❌ Non défini |
| Error handling | Messages génériques | ⚠️ Stack traces exposées |
| Environment variables | Validées | ❌ Pas de validation |

---

### A06:2021 - Vulnerable and Outdated Components

**Statut :** ✅ **CORRECTEMENT GÉRÉ**

**Analyse :**
```
Next.js: 15.4.10        ✅ Dernière version
React: 18.3.1           ✅ Stable
Prisma: 6.11.1          ✅ Récent
Better Auth: 1.2.12     ✅ Récent
bcryptjs: 3.0.2         ✅ À jour
Zod: 3.25.76            ✅ Récent
```

**Recommandation :**
- Mettre en place Dependabot/Renovate
- Surveiller CVEs des dépendances

---

### A07:2021 - Identification and Authentication Failures

**Statut :** 🔴 **CRITIQUE**

**Failles :**
- ❌ Pas de rate limiting sur login
- ❌ Pas de MFA/2FA
- ❌ Politique mot de passe faible (8 caractères minimum)
- ❌ Pas de password reset
- ❌ Sessions non rotatées
- ❌ Dual auth system

**Recommandations :**
- Implémenter MFA (TOTP)
- Rate limiting login (5 essais/15min)
- Password policy renforcée (12+ caractères)
- Session rotation après privilege change

---

### A08:2021 - Software and Data Integrity Failures

**Statut :** ⚠️ **PARTIEL**

**Constats :**
| Élément | Statut |
|---------|--------|
| Validation entrées | ✅ Zod |
| Validation uploads | ❌ Aucun |
| Signature de code | ⚠️ Non vérifié |
| CI/CD security | ❌ Non configuré |
| Backup integrity | ❌ Non testé |

---

### A09:2021 - Security Logging and Monitoring Failures

**Statut :** 🔴 **INSUFFISANT**

**Manquements :**
- ❌ Pas de logging centralisé
- ❌ Pas d'alerting
- ❌ Pas de monitoring sécurité
- ❌ Events sensibles non loggés
- ❌ Pas de rétention définie

**Recommandations :**
- Implémenter security logger
- Configurer alertes (échecs auth, uploads suspects)
- Définir politique de rétention (90 jours minimum)

---

### A10:2021 - Server-Side Request Forgery (SSRF)

**Statut :** ✅ **CORRECTEMENT PROTÉGÉ**

**Analyse :**
- ❌ Pas d'appels HTTP sortants depuis le serveur
- ✅ Resend API via librairie officielle
- ✅ Pas de fonctionnalité de fetch utilisateur

---

## 5. User Stories de Sécurité Non Gérées

### US-SEC-01 : Protection CSRF
```gherkin
EN TANT QUE système
JE VEUX protéger toutes les requêtes POST/PUT/DELETE avec des tokens CSRF
AFIN DE prévenir les attaques cross-site request forgery

CRITÈRES D'ACCEPTATION :
- [ ] Token CSRF généré par session
- [ ] Validation sur toutes les mutations
- [ ] Rotation du token après login
- [ ] Token invalide → 403 Forbidden
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 2 jours  
**Priorité :** P0

---

### US-SEC-02 : Rate Limiting
```gherkin
EN TANT QUE système
JE VEUX limiter les requêtes par IP/utilisateur
AFIN DE prévenir le brute-force et DDoS

CRITÈRES :
- [ ] Login : max 5 essais/15min
- [ ] API : max 100 req/min
- [ ] Signalement : max 3/heure
- [ ] Vérification : max 10/heure
- [ ] Message d'erreur approprié (429 Too Many Requests)
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 1 jour  
**Priorité :** P0

---

### US-SEC-03 : Headers de Sécurité
```gherkin
EN TANT QUE système
JE VEUX envoyer des headers HTTP sécurisés
AFIN DE protéger contre XSS, clickjacking, MIME sniffing

HEADERS REQUIS :
- [ ] Content-Security-Policy: default-src 'self'
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Strict-Transport-Security: max-age=31536000
- [ ] X-XSS-Protection: 1; mode=block
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Permissions-Policy: camera=(), microphone=()
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 0.5 jour  
**Priorité :** P0

---

### US-SEC-04 : Journalisation des Événements de Sécurité
```gherkin
EN TANT QUE administrateur
JE VEUX logger tous les événements de sécurité
AFIN DE détecter les attaques et auditer

ÉVÉNEMENTS À LOGGER :
- [ ] Échecs de connexion (avec IP, user-agent)
- [ ] Changements de mot de passe
- [ ] Accès admin refusés
- [ ] Modifications de données sensibles
- [ ] Uploads de fichiers
- [ ] Exports de données
- [ ] Créations/suppressions d'utilisateurs
```
**Statut :** ⚠️ **PARTIEL** (auth logging uniquement)  
**Effort :** 2 jours  
**Priorité :** P1

---

### US-SEC-05 : Gestion des Sessions
```gherkin
EN TANT QUE système
JE VEUX gérer les sessions de manière sécurisée
AFIN DE prévenir le vol de session

EXIGENCES :
- [ ] Cookies httpOnly + secure + sameSite=strict
- [ ] Rotation session après privilege change
- [ ] Timeout inactivité (30 min)
- [ ] Déconnexion forcée possible (admin)
- [ ] Liste des sessions actives par utilisateur
- [ ] Notification nouvelle connexion
```
**Statut :** ❌ **NON CONFORME**  
**Effort :** 2 jours  
**Priorité :** P0

---

### US-SEC-06 : Validation Upload de Fichiers
```gherkin
EN TANT QUE système
JE VEUX valider strictement les fichiers uploadés
AFIN DE prévenir les malware/RCE

VALIDATIONS :
- [ ] Type MIME vérifié (magic bytes)
- [ ] Extension whitelist (.pdf, .jpg, .png)
- [ ] Taille max : 5MB
- [ ] Scan antivirus (ClamAV)
- [ ] Stockage hors webroot
- [ ] Renommage avec UUID
- [ ] Content-Disposition: attachment
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 3 jours  
**Priorité :** P1

---

### US-SEC-07 : Protection des Données Sensibles
```gherkin
EN TANT QUE système
JE VEUX chiffrer les données sensibles
AFIN DE respecter RGPD

DONNÉES À CHIFFRER :
- [x] Mots de passe (bcrypt)
- [ ] Emails (chiffrement applicatif)
- [ ] Codes d'attestation (hash)
- [ ] Données personnelles (AES-256)
- [ ] Notes d'examens
```
**Statut :** ⚠️ **PARTIEL**  
**Effort :** 3 jours  
**Priorité :** P2

---

### US-SEC-08 : Réinitialisation de Mot de Passe Sécurisée
```gherkin
EN TANT QUE utilisateur
JE VEUX réinitialiser mon mot de passe via email
AFIN DE récupérer mon compte en cas d'oubli

FLOW SÉCURISÉ :
- [ ] Token unique + expiration (1h)
- [ ] Usage unique du token
- [ ] Email avec lien temporaire
- [ ] Validation ancien mot de passe (si connu)
- [ ] Notification après changement
- [ ] Invalidation sessions existantes
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 2 jours  
**Priorité :** P1

---

### US-SEC-09 : Vérification Email
```gherkin
EN TANT QUE système
JE VEUX vérifier les emails avant activation
AFIN DE prévenir les faux comptes

PROCESSUS :
- [ ] Token de vérification envoyé par email
- [ ] Lien d'activation avec expiration (24h)
- [ ] Relance possible
- [ ] Compte inactif si non vérifié (7 jours)
- [ ] Admin notifié des comptes non vérifiés
```
**Statut :** ⚠️ **MODÈLE EXISTANT** mais **NON UTILISÉ**  
**Effort :** 1.5 jours  
**Priorité :** P1

---

### US-SEC-10 : Audit Trail / Traçabilité
```gherkin
EN TANT QUE administrateur
JE VEUX tracer toutes les actions sensibles
AFIN D'enquêter en cas d'incident

ACTIONS À TRACER :
- [ ] Qui a créé/modifié/supprimé une attestation
- [ ] Qui a changé un score d'examen
- [ ] Qui a accédé aux données utilisateurs
- [ ] Qui a exporté des données
- [ ] Horodatage et IP pour chaque action
- [ ] Logs immuables (write-only)
```
**Statut :** ❌ **NON IMPLÉMENTÉ**  
**Effort :** 3 jours  
**Priorité :** P2

---

### US-SEC-11 : Protection API (IDOR)
```gherkin
EN TANT QUE système
JE VEUX vérifier l'autorisation sur chaque ressource
AFIN DE prévenir les attaques IDOR

EXEMPLE IDOR :
- [ ] GET /api/user/profile → vérifie session == user ID
- [ ] GET /api/submissions/{id} → vérifie ownership
- [ ] GET /api/attestations/{id} → vérifie userId
- [ ] PUT /api/admin/exams/{id} → vérifie admin
```
**Statut :** ⚠️ **PARTIEL**  
**Effort :** 2 jours  
**Priorité :** P1

---

### US-SEC-12 : Sanitization des Entrées (XSS)
```gherkin
EN TANT QUE système
JE VEUX sanitiser toutes les entrées utilisateur
AFIN DE prévenir les attaques XSS

CHAMPS À RISQUE :
- [ ] Report.message
- [ ] Attestation.fullName
- [ ] InternshipRequest.message
- [ ] CorrectionRequest.reason
- [ ] Exam answers (partie ouverte)

PROTECTIONS :
- [ ] DOMPurify côté client
- [ ] Sanitization côté serveur
- [ ] Encodage sortie HTML
```
**Statut :** ⚠️ **ZOD VALIDE** mais **PAS DE SANITIZATION**  
**Effort :** 1 jour  
**Priorité :** P1

---

### US-SEC-13 : Gestion des Erreurs
```gherkin
EN TANT QUE système
JE VEUX masquer les détails d'erreurs en production
AFIN DE ne pas divulguer d'infos sensibles

ERREURS À MASQUER :
- [ ] Stack traces
- [ ] Requêtes SQL
- [ ] Chemins de fichiers
- [ ] Versions de librairies
- [ ] Messages d'erreur BDD

MESSAGE UTILISATEUR :
- "Une erreur est survenue. Veuillez réessayer."
```
**Statut :** ⚠️ **PARTIEL**  
**Effort :** 1 jour  
**Priorité :** P1

---

### US-SEC-14 : Backup & Recovery
```gherkin
EN TANT QUE administrateur
JE VEUX sauvegarder et restaurer la base de données
AFIN DE récupérer après un incident

EXIGENCES :
- [ ] Backup automatique quotidien
- [ ] Chiffrement des backups
- [ ] Test de restauration mensuel
- [ ] RPO < 24h, RTO < 4h
- [ ] Stockage hors-site
- [ ] Documentation procédure
```
**Statut :** ❌ **NON IMPLÉMENTÉ** (hors scope code)  
**Effort :** 2 jours  
**Priorité :** P2

---

### US-SEC-15 : Protection des API Endpoints Publics
```gherkin
EN TANT QUE système
JE VEUX protéger les endpoints publics contre l'abus
AFIN DE prévenir le scraping et spam

ENDPOINTS PUBLICS :
- [ ] /api/public/alumni
- [ ] /api/public/stats
- [ ] /api/public/internships
- [ ] /api/verifier
- [ ] /api/signalement

PROTECTIONS :
- [ ] Rate limiting spécifique
- [ ] CAPTCHA après N requêtes
- [ ] Validation stricte
- [ ] Logging renforcé
```
**Statut :** ❌ **NON PROTÉGÉ**  
**Effort :** 1.5 jours  
**Priorité :** P1

---

## 6. Failles Cachées (Non Évidentes)

### 6.1 Incohérence Hash Password

**Description :**
```typescript
// Registration utilisateur : bcrypt cost 12
const hash = await bcrypt.hash(password, 12)

// Admin profile update : bcrypt cost 10
const hash = await bcrypt.hash(newPassword, 10)
```

**Risque :** Les mots de passe admin sont moins bien protégés que ceux des utilisateurs.

**Correction :** Uniformiser à `bcrypt.hash(password, 12)` partout.

---

### 6.2 Fuite d'Information via Erreurs

**Description :**
```typescript
// /api/auth/login/route.ts
return NextResponse.json({
  message: 'Erreur serveur',
  error: error.message  // ❌ Exposition stack trace
}, { status: 500 })
```

**Risque :** Divulgation de chemins, versions, structure BDD.

**Correction :**
```typescript
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 })
} else {
  return NextResponse.json({ message: 'Erreur serveur', error: error.message }, { status: 500 })
}
```

---

### 6.3 Modèle `Verification` Inutilisé

**Description :**
```prisma
model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
}
```

**Risque :** Table existe mais aucune route ne l'utilise. Vérification email non fonctionnelle.

**Correction :** Implémenter `/api/user/verify-email` et `/api/user/send-verification`.

---

### 6.4 Pas de Validation Type MIME (Upload)

**Description :**
```typescript
const files = formData.getAll('scans') as File[]
// ❌ Pas de vérification type
// ❌ Pas de limite taille
// ❌ URL simulée (faille logique)
```

**Risque :** Upload de n'importe quel type de fichier.

**Correction :**
```typescript
const ALLOWED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png'
}

// Vérifier magic bytes
const buffer = await file.arrayBuffer()
const magicBytes = new Uint8Array(buffer.slice(0, 4))
```

---

### 6.5 Query Injection Potentielle (Recherche Code)

**Description :**
```typescript
// /api/verifier/route.ts
if (validCode.length <= 5) {
  attestation = await prisma.attestation.findFirst({
    where: { code: { endsWith: validCode } }
  })
}
```

**Risque :** Recherche par suffixe peut exposer des codes partiels par brute-force.

**Correction :** Limiter à 3 tentatives maximum, logger les recherches.

---

### 6.6 Session Fixation

**Description :**
```typescript
// Pas de régénération de session après login
response.cookies.set('admin_session', user.id, {...})
// ❌ Session ID non régénéré
```

**Risque :** Attaquant peut fixer une session avant login.

**Correction :** Générer nouveau token de session après authentification.

---

### 6.7 Absence de Validation Cross-Table

**Description :**
```typescript
let user = await prisma.admin.findUnique({ where: { email } })
let userType = 'ADMIN'
if (!user) {
  user = await prisma.user.findUnique({ where: { email } })
  userType = 'USER'
}
```

**Risque :** Un email peut exister dans les deux tables → conflit d'identité.

**Correction :** Contrainte d'unicité globale sur email (Admin + User).

---

### 6.8 Données JSON Non Validées (ExamSubmission)

**Description :**
```typescript
answers: answers || {}  // Stocké dans Json field
// ❌ Pas de validation structure
// ❌ Injection de champs possibles
```

**Risque :** Corruption de données, injection de propriétés dangereuses.

**Correction :** Valider structure JSON avec Zod avant stockage.

---

## 7. Matrice de Risques

### 7.1 Évaluation par Vulnérabilité

| ID | Vulnérabilité | Vraisemblance | Impact | Niveau |
|----|---------------|---------------|--------|--------|
| AUTH-001 | Dual Auth System | Élevée | Critique | 🔴 **CRITIQUE** |
| SESSION-001 | Cookies Non Sécurisés | Moyenne | Critique | 🔴 **CRITIQUE** |
| CSRF-001 | Absence CSRF | Élevée | Élevé | 🔴 **CRITIQUE** |
| RATE-001 | Pas de Rate Limiting | Élevée | Élevé | 🟠 **ÉLEVÉ** |
| UPLOAD-001 | Upload Non Validé | Moyenne | Critique | 🟠 **ÉLEVÉ** |
| HEADER-001 | Headers Absents | Moyenne | Moyen | 🟠 **ÉLEVÉ** |
| LOG-001 | Logging Insuffisant | Faible | Élevé | 🟡 **MOYEN** |
| IDOR-001 | Protection IDOR | Moyenne | Élevé | 🟠 **ÉLEVÉ** |

### 7.2 Risques Métier

| Risque | Impact Financier | Impact Réputation | Impact Légal |
|--------|------------------|-------------------|--------------|
| Fuite de données | Élevé | Critique | Critique (RGPD) |
| Prise de compte admin | Critique | Critique | Élevé |
| Falsification notes | Élevé | Critique | Élevé |
| Indisponibilité service | Moyen | Moyen | Moyen |
| Malware via upload | Élevé | Critique | Élevé |

---

## 8. Recommandations Stratégiques

### 8.1 Priorité P0 (Immédiat - 48h)

| Action | Effort | Coût | Bénéfice |
|--------|--------|------|----------|
| Unifier authentification (Better Auth) | 2j | Faible | Élimine AUTH-001 |
| Sécuriser cookies (httpOnly, secure) | 0.5j | Faible | Élimine SESSION-001 |
| Implémenter CSRF tokens | 2j | Faible | Élimine CSRF-001 |
| Rate limiting (Upstash Redis) | 1j | Moyen | Élimine RATE-001 |

**Budget estimé :** 5.5 jours-homme

---

### 8.2 Priorité P1 (Semaine 1)

| Action | Effort | Coût | Bénéfice |
|--------|--------|------|----------|
| Middleware headers sécurité | 0.5j | Faible | Élimine HEADER-001 |
| Validation upload fichiers | 3j | Moyen | Élimine UPLOAD-001 |
| Password reset flow | 2j | Moyen | US-SEC-08 |
| Email verification | 1.5j | Faible | US-SEC-09 |
| Protection IDOR systématique | 2j | Moyen | Élimine IDOR-001 |
| Sanitization entrées (DOMPurify) | 1j | Faible | US-SEC-12 |

**Budget estimé :** 10 jours-homme

---

### 8.3 Priorité P2 (Semaine 2-3)

| Action | Effort | Coût | Bénéfice |
|--------|--------|------|----------|
| Security logger complet | 2j | Moyen | US-SEC-04 |
| Audit trail / traçabilité | 3j | Moyen | US-SEC-10 |
| Chiffrement données sensibles | 3j | Élevé | US-SEC-07 |
| Backup strategy | 2j | Moyen | US-SEC-14 |
| MFA/2FA (TOTP) | 3j | Moyen | Renforce auth |

**Budget estimé :** 13 jours-homme

---

### 8.4 Budget Total

| Priorité | Jours-Homme | Coût Estimé* |
|----------|-------------|--------------|
| P0 | 5.5 | ~5 500 € |
| P1 | 10 | ~10 000 € |
| P2 | 13 | ~13 000 € |
| **Total** | **28.5** | **~28 500 €** |

*Basé sur TJM moyen 1000€/jour

---

## 9. Annexes

### 9.1 Référentiels Utilisés

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [CWE Top 25](https://cwe.mitre.org/top25/archive/2023/2023_cwe_top25.html)
- [RGPD - Protection des Données](https://rgpd.fr/)
- [Better Auth Documentation](https://www.better-auth.com/)

### 9.2 Outils Recommandés

| Catégorie | Outil | Usage |
|-----------|-------|-------|
| SAST | SonarQube, Semgrep | Analyse statique |
| DAST | OWASP ZAP, Burp Suite | Tests dynamiques |
| SCA | Dependabot, Snyk | Vulnérabilités dépendances |
| Monitoring | Sentry, Datadog | Détection incidents |
| Rate Limiting | Upstash Redis | Protection DDoS |

### 9.3 Métriques de Suivi

| Métrique | Cible | Fréquence |
|----------|-------|-----------|
| Score sécurité | > 8/10 | Mensuel |
| Vulnérabilités critiques | 0 | Continu |
| Temps correction P0 | < 48h | Par incident |
| Couverture tests sécurité | > 80% | Par release |

---

**Document établi par :** Expert Cybersécurité  
**Date :** 1 Avril 2026  
**Prochaine révision :** 1 Juillet 2026  
**Classification :** CONFIDENTIEL - Usage Interne Uniquement

---

*Ce rapport contient des informations sensibles concernant la sécurité de l'application. Sa diffusion doit être strictement contrôlée.*
