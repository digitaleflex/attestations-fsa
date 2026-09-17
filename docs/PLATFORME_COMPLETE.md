# 📘 FSA - Documentation Complète de la Plateforme

> **Ferme Saint André - Plateforme Technologique d'Attestations & Examens**  
> **Dernière mise à jour :** 16 septembre 2026 (réalignement sur le code réel — issue #86)  
> **Version :** 2.0.0

> ⚠️ **Réalignement (issue #86)** : les modules **Portfolio, Chat, Ressources
> pédagogiques, Waitlist et Annuaire** ont été **retirés du produit le 2026-06-22**
> (commit `960852f`, 44 fichiers, 5 348 lignes). Les sections de ce document qui les
> décrivaient comme existants (§6, §7, §11) ont été corrigées. Aucune des routes,
> pages ou modèles Prisma de ces modules ne subsiste dans le schéma ni dans `app/`.

---

## 📑 Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture Technique](#2-architecture-technique)
3. [Système Anti-Triche](#3-système-anti-triche)
4. [Programmation d'Examens & Compte à Rebours](#4-programmation-dexamens--compte-à-rebours)
5. [Système de Monitoring Admin](#5-système-de-monitoring-admin)
6. [Gestion des Emails](#6-gestion-des-emails)
7. [Système de Portfolios (retiré)](#7-système-de-portfolios-retiré)
8. [Sécurité & Headers](#8-sécurité--headers)
9. [Police & Design](#9-police--design)
10. [Roadmap Future](#10-roadmap-future)
11. [Audit & Correctifs Appliqués](#11-audit--correctifs-appliqués)

---

## 1. Vue d'ensemble

### 🎯 Mission
Plateforme de gestion des attestations de formation avec :
- Création et gestion d'examens (QCM, questions ouvertes, études de cas)
- Génération d'attestations certifiées avec codes de vérification
- Surveillance anti-triche intelligente

### 👥 Utilisateurs
| Rôle | Accès | Fonctionnalités |
|------|-------|-----------------|
| **Admin** | `/admin/*` | Créer examens, valider attestations, voir monitoring, gérer users |
| **Candidat** | `/exams`, `/attestations` | Passer examens, voir résultats, télécharger attestations |
| **Public** | `/verifier`, `/formations`, `/contact` | Vérifier l'authenticité des attestations, consulter les formations |

---

## 2. Architecture Technique

### Stack Technologique
```
Frontend:    Next.js 16 (App Router) + React 19 + TypeScript
Styling:     Tailwind CSS 4 + shadcn/ui + Framer Motion
Backend:     Next.js API Routes + Better Auth
Database:    PostgreSQL + Prisma ORM
Cache/Rate:  Upstash Redis
Emails:      Resend
PDF:         html2pdf.js + jsPDF
Charts:      Chart.js + Recharts
State:       TanStack Query
```

### Structure des Dossiers
```
attestations-fsa/
├── app/
│   ├── (public)/          # Pages publiques (FAQ, signalement, verifier)
│   ├── (user)/            # Espace candidat (exams, attestations, dashboard)
│   ├── admin/             # Dashboard admin (exams, users, monitoring, attestations)
│   └── api/               # Routes API (auth, exams, submissions, monitoring)
├── components/            # UI Components (exams, auth, anti-cheat)
├── lib/                   # Utilities (auth, rate-limit, anti-cheat, email)
├── prisma/                # Schema Prisma + migrations
└── docs/                  # Documentation
```

---

## 3. Système Anti-Triche

### 3.1 Protection CSRF

> ⚠️ **Corrigé (issue #86)** : la couche CSRF décrite ici (cookie `csrf_token` +
> header `x-csrf-token`, fichiers `middleware.ts` et `lib/csrf.ts`) **n'existe pas**.
> Elle a été retirée comme « factice » par #142 A1 (PR #189) : le cookie n'était
> jamais posé ni validé côté serveur (voir `lib/api-client.ts:27-29`).

| Détail | Valeur (état réel vérifié dans le code) |
|--------|--------|
| **Protection CSRF réelle** | Cookie de session `SameSite=Lax` (Better Auth) + BotID sur `/api/exams/*/submit` |
| **Garde d'accès** | `proxy.ts` (ex-`middleware.ts`, migré Next 16 par #79) : pré-filtre du cookie de session sans DB, validation réelle en aval (`lib/api-auth`) |

### 3.2 Rate Limiting (Double Couche)
| Type | Limite | Fenêtre | Fichier |
|------|--------|---------|---------|
| Login | 5 | 15 min | `lib/rate-limit.ts` |
| Register | 3 | 1 heure | `lib/rate-limit.ts` |
| Submission | 5 | 1 heure | `lib/rate-limit.ts` |
| Verify | 10 | 1 heure | `lib/rate-limit.ts` |
| Internship | 3 | 1 heure | `lib/rate-limit.ts` |

**Double vérification:** IP **ET** userId (empêche contournement via VPN)

### 3.3 Détection de Soumission Trop Rapide
| Détail | Valeur |
|--------|--------|
| **Seuil** | < 30 secondes = suspect |
| **Action** | Rejet + log SecurityLog (severity: HIGH) |
| **Fichier** | `app/api/exams/[id]/submit/route.ts` |

### 3.4 Analyse de Patterns de Réponses
| Détail | Valeur |
|--------|--------|
| **Détection** | Réponses 100% identiques entre utilisateurs |
| **Similarité** | >90% = flaggé |
| **Algorithme** | Similarité Jaccard + exact match |
| **Fichier** | `lib/anti-cheat.ts` |
| **Action** | Session flaggée (scorePart2 = -1), log admin |

### 3.5 Watermarking d'Attestations
| Détail | Valeur |
|--------|--------|
| **Filigrane visible** | Pattern diagonal 3% opacité |
| **Filigrane invisible** | Pixels de vérification + fingerprint cryptographique |
| **Vérification** | Fonction `verifyWatermark()` server-side |
| **Fichier** | `components/AttestationWatermark.tsx` |

### 3.6 Détection de Changement d'Onglet
| Détail | Valeur |
|--------|--------|
| **Technologie** | Page Visibility API + Window Blur/Focus |
| **Détection multi-onglets** | LocalStorage sync |
| **Seuil Warning** | 3 changements d'onglet |
| **Seuil Critical** | 5 changements ou multi-onglets |
| **Fichiers** | `lib/useExamMonitoring.ts`, `app/api/exams/monitoring/route.ts` |
| **UI** | Banner warning + toast notifications pendant l'examen |

---

## 4. Programmation d'Examens & Compte à Rebours

### 4.1 Côté Admin
| Détail | Valeur |
|--------|--------|
| **Composant** | `components/exams/form-steps/step-general.tsx` |
| **Champ** | `datetime-local` picker pour date/heure |
| **Status** | DRAFT, 📅 SCHEDULED, ✅ PUBLISHED, 📦 ARCHIVED |
| **Validation** | Warning si SCHEDULED sans date |

### 4.2 Côté Candidat
| Détail | Valeur |
|--------|--------|
| **Composant** | `components/CountdownTimer.tsx` |
| **Affichage** | Jours, Heures, Minutes, Secondes en temps réel |
| **Couleurs** | 🔵 Bleu (>1j), 🟡 Jaune (<24h), 🔴 Rouge (<1h), 🟢 Vert (disponible) |
| **Page** | `/exams` - Section "Examens Programmés" |

---

## 5. Système de Monitoring Admin

### 5.1 Dashboard
| Détail | Valeur |
|--------|--------|
| **URL** | `/admin/monitoring` |
| **Fichier** | `app/admin/monitoring/page.tsx` |
| **API** | `app/api/admin/monitoring/route.ts` |
| **Auto-refresh** | 30 secondes |

### 5.2 Statistiques Affichées
| Carte | Description |
|-------|-------------|
| 🚨 Alertes Critiques | Sévérité CRITICAL |
| 🔄 Changements d'Onglet | Détections EXAM_MONITORING |
| ⚠️ Triche Détectée | CHEATING_DETECTED events |
| ✅ Examens Terminés | Sessions COMPLETED |
| ⏱️ Soumissions Rapides | SUBMISSION_TOO_FAST |
| 👥 Candidats Actifs | Users avec rôle USER |

### 5.3 Logs de Sécurité
| Champ | Description |
|-------|-------------|
| `eventType` | EXAM_MONITORING, CHEATING_DETECTED, SUSPICIOUS_ACTIVITY |
| `severity` | LOW, MEDIUM, HIGH, CRITICAL |
| `action` | TAB_SWITCH, IDENTICAL_ANSWERS, SUBMISSION_TOO_FAST |
| `details` | JSON complet avec données contextuelles |

---

## 6. Gestion des Emails

> ⚠️ **Module Waitlist retiré (issue #86)** : la waitlist a été supprimée du produit
> le 2026-06-22 (commit `960852f`). À ce jour, il n'existe **aucun** modèle Prisma
> `Waitlist` (schéma vérifié : 22 modèles, aucun `Waitlist`), **aucune** page
> `app/admin/waitlist/`, **aucune** API `app/api/waitlist` ni
> `app/api/admin/waitlist`, et **aucune** clé `waitlist` dans `lib/rate-limit.ts`.
> Les anciennes sections 6.1 (« Modèle Waitlist (NOUVEAU) ») et 6.2 (« Page Admin
> Waitlist ») de ce document décrivaient du code inexistant ; elles ont été retirées.

### 6.1 Vérification Email à l'Inscription

- Demande d'envoi : `app/api/user/send-verification/route.ts` (authentifié,
  rate limit `emailVerification` 5/heure — `lib/rate-limit.ts:196`)
- Token unique : `randomBytes(32)` hexadécimal, stocké dans le modèle `Verification`,
  expiration 24 heures (`send-verification/route.ts:48-49`)
- Lien envoyé : `/api/user/verify-email?token=xxx`
  (`app/api/user/verify-email/route.ts`)

---

## 7. Système de Portfolios (retiré)

> ⚠️ **Module Portfolio retiré (issue #86)** : supprimé du produit le 2026-06-22
> (commit `960852f`). Les anciennes sections 7.1 à 7.4 de ce document listaient des
> API et une page qui **n'existent plus** :
> - `/api/public/portfolios`, `/api/public/portfolios/[slug]`, `/api/user/portfolio`,
>   `/api/admin/users/portfolio` : aucune de ces routes n'est présente dans `app/api/` ;
> - page publique `/portfolios` (`app/(public)/portfolios/`) et espace `app/p/` :
>   inexistants ;
> - aucun modèle Prisma lié aux portfolios dans le schéma ;
> - le lien footer `/portfolios` a été retiré par `80f1c82` (PR #166, issue #31) et
>   la page n'a jamais été recréée.
>
> Les compteurs d'API encore compatibles renvoient explicitement 0 avec la mention
> « fonctionnalité Portfolio non déployée »
> (`app/api/admin/dashboard/overview/route.ts:29`,
> `app/api/admin/sidebar-counts/route.ts:12`).

---

## 8. Sécurité & Headers

### 8.1 Headers de Sécurité (`next.config.mjs`)

> **Corrigé (issue #86)** : les en-têtes sont posés par le bloc `headers()` de
> `next.config.mjs` (implémenté par #142 A1), et non par un `middleware.ts`
> (fichier migré en `proxy.ts` par #79, dédié à l'authentification).

| Header | Valeur (vérifiée dans `next.config.mjs:31-45`) | Protection |
|--------|--------|------------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer control |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | APIs dangereuses |
| `HSTS` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `CSP` | `default-src 'self'` ; scripts `'unsafe-inline' 'unsafe-eval'` + `api.vercel.com` (BotID) ; `frame-ancestors 'none'` | XSS + injection |

### 8.2 Sanitisation d'Entrées
| Fonction | Fichier | Usage |
|----------|---------|-------|
| `sanitizeInput()` | `lib/sanitization.ts` | Login, register, report |
| `sanitizeObject()` | `lib/sanitization.ts` | Objets imbriqués |
| `sanitizeFilename()` | `lib/sanitization.ts` | Uploads de fichiers |
| Magic Bytes Validation | `app/api/admin/submissions/[id]/scans/route.ts` | PDF, JPG, PNG |

---

## 9. Police & Design

### 9.1 Typographie
| Propriété | Valeur |
|-----------|--------|
| **Police** | `Inter` (Google Fonts) |
| **Import** | `next/font/google` (hébergé localement) |
| **Subset** | `latin` |
| **Performance** | Zéro layout shift, optimisé Next.js |

### 9.2 Design System
| Élément | Valeur |
|---------|--------|
| **Framework CSS** | Tailwind CSS 4 |
| **Composants UI** | shadcn/ui |
| **Animations** | Framer Motion |
| **Icônes** | Lucide React |
| **Charts** | Chart.js + Recharts |

---

## 10. Roadmap Future

### Phase 1: Maturité (0-6 mois)
- [ ] Vérification QR Code publique
- [ ] Export PDF des rapports admin
- [ ] Templates d'emails personnalisables
- [ ] Mode hors-ligne (PWA)
- [ ] Analytics avancés

### Phase 2: Intelligence (6-12 mois)
- [ ] IA d'analyse de triche (Machine Learning)
- [ ] Génération d'examens par IA
- [ ] Proctoring intelligent (webcam, souris)
- [ ] Badges numériques (Open Badges 3.0)
- [ ] Recommandation de formations IA

### Phase 3: Écosystème (12-18 mois)
- [ ] API publique pour recruteurs
- [ ] Blockchain pour attestations (Polygon)
- [ ] CV numérique auto-généré
- [ ] Partenaires certifiants externes
- [ ] Mobile App (React Native)

### Phase 4: Plateforme (18-24 mois)
- [ ] Marketplace de formations
- [ ] Paiement intégré (Stripe)
- [ ] Mentorat & visio
- [ ] Gamification avancée
- [ ] Multilingue (FR/EN/ES)

---

## 11. Audit & Correctifs Appliqués

> ⚠️ **Tableaux historiques (audit d'avril 2026) — corrigés le 2026-09-16 (issue #86).**
> Les lignes concernant **Waitlist** et **Portfolios** décrivent des fichiers
> **depuis supprimés** par `960852f` (2026-06-22) ; elles ne décrivent plus l'état
> actuel du code.

### 11.1 Problèmes Critiques Corrigés

| # | Problème | Fichier | Solution |
|---|----------|---------|----------|
| **1** | Emails waitlist NON sauvegardés en base | `app/api/waitlist/route.ts` | Ajout modèle Waitlist + `prisma.waitlist.create()` — **module et fichier depuis supprimés (`960852f`)** |
| **2** | Pas de rate limiting waitlist | `lib/rate-limit.ts` | Ajout clé `waitlist` (5/heure) — **clé depuis retirée (`960852f`)** |
| **3** | Email auto-vérifié sans vérification | `app/api/auth/register/route.ts` | `emailVerified: null` + envoi email vérification — **fichier depuis supprimé ; l'inscription passe par Better Auth (`app/api/auth/[...better-auth]/route.ts`)** |
| **4** | Pas de sanitization admin users | `app/api/users/route.ts` | Ajout `sanitizeInput()` (toujours présent, `app/api/users/route.ts:134`) |
| **5** | Pas de rate limit internship | `app/api/public/internships/route.ts` | Ajout `applyRateLimit()` + Zod schema (toujours présents, `app/api/public/internships/route.ts:10,24`) |

### 11.2 Fichiers Créés/Modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | ✏️ Modifié | Ajout modèle Waitlist — **modèle retiré depuis (`960852f`)** |
| `lib/rate-limit.ts` | ✏️ Modifié | +internship (toujours présent) ; +waitlist — **clé retirée depuis (`960852f`)** |
| `app/api/waitlist/route.ts` | 🗑️ Créé puis supprimé | Sauvegarde DB + doublons — **supprimé par `960852f`** |
| `app/api/auth/register/route.ts` | 🗑️ Modifié puis supprimé | Email vérification auto — **supprimé ; inscription via Better Auth** |
| `app/api/users/route.ts` | ✏️ Modifié | Sanitization email (toujours présente) |
| `app/api/public/internships/route.ts` | ✏️ Modifié | Rate limit + validation (toujours présents) |
| `app/api/admin/waitlist/route.ts` | 🗑️ Créé puis supprimé | API admin waitlist — **supprimé par `960852f`** |
| `app/admin/waitlist/page.tsx` | 🗑️ Créé puis supprimé | Interface admin waitlist — **supprimée par `960852f`** |
| `app/api/public/portfolios/route.ts` | 🗑️ Créé puis supprimé | API publique portfolios — **supprimée par `960852f`** |
| `app/api/public/portfolios/[slug]/route.ts` | 🗑️ Créé puis supprimé | API portfolio par slug — **supprimée par `960852f`** |
| `app/api/user/portfolio/route.ts` | 🗑️ Créé puis supprimé | Config portfolio utilisateur — **supprimée par `960852f`** |
| `app/api/admin/users/portfolio/route.ts` | 🗑️ Créé puis supprimé | Admin gestion portfolios — **supprimée par `960852f`** |
| `app/(public)/portfolios/page.tsx` | 🗑️ Supprimé | Page portfolios — **supprimée par `960852f`, jamais recréée** |
| `middleware.ts` | ✏️ Modifié | CSRF activé — **couche retirée depuis (#142 A1) ; fichier migré en `proxy.ts` (#79)** |
| `lib/csrf.ts` | 🗑️ Créé puis supprimé | Utilitaires CSRF — **retiré comme « factice » (#142 A1)** |
| `lib/anti-cheat.ts` | ✨ Créé | Analyse patterns réponses (toujours présent) |
| `lib/useExamMonitoring.ts` | ✨ Créé | Hook surveillance examen (toujours présent) |
| `app/api/exams/monitoring/route.ts` | ✨ Créé | API monitoring (toujours présente) |
| `components/CountdownTimer.tsx` | ✨ Créé | Compte à rebours examens (toujours présent) |
| `components/AttestationWatermark.tsx` | ✨ Créé | Watermark anti-falsification (toujours présent) |
| `components/exams/form-steps/step-general.tsx` | ✏️ Modifié | Datetime picker + SCHEDULED (toujours présent) |
| `components/OfficialDocument.tsx` | ✏️ Modifié | Intégration watermark (toujours présent) |

### 11.3 Prochaines Étapes Requises

> ⚠️ **Corrigé (issue #86)** : cette procédure demandait de pousser le modèle
> `Waitlist` en base (`npx prisma db push`). Ce modèle a été **retiré** du schéma
> Prisma par `960852f` (2026-06-22) : il n'y a plus rien à pousser. Étapes
> effectivement applicables pour valider un build local :

```bash
npm run build
npm run dev
```

---

## 📞 Support & Maintenance

| Besoin | Action |
|--------|--------|
| Voir les logs de triche | `/admin/monitoring` |
| Ajuster les seuils anti-triche | `lib/anti-cheat.ts`, `app/api/exams/[id]/submit/route.ts` |
| Modifier les rate limits | `lib/rate-limit.ts` |
| Changer les emails | `lib/email.ts` |

---

**📄 Document réaligné manuellement sur le code le 16 septembre 2026 (issue #86).**
