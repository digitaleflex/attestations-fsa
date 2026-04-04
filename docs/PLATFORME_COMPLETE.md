# 📘 FSA - Documentation Complète de la Plateforme

> **Ferme Saint André - Plateforme Technologique d'Attestations & Examens**  
> **Dernière mise à jour :** Avril 2026  
> **Version :** 2.0.0

---

## 📑 Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture Technique](#2-architecture-technique)
3. [Système Anti-Triche](#3-système-anti-triche)
4. [Programmation d'Examens & Compte à Rebours](#4-programmation-dexamens--compte-à-rebours)
5. [Système de Monitoring Admin](#5-système-de-monitoring-admin)
6. [Gestion des Emails & Waitlist](#6-gestion-des-emails--waitlist)
7. [Système de Portfolios](#7-système-de-portfolios)
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
- Portfolios numériques publics pour diplômés

### 👥 Utilisateurs
| Rôle | Accès | Fonctionnalités |
|------|-------|-----------------|
| **Admin** | `/admin/*` | Créer examens, valider attestations, voir monitoring, gérer users |
| **Candidat** | `/exams`, `/attestations` | Passer examens, voir résultats, télécharger attestations |
| **Public** | `/portfolios`, `/verifier` | Voir portfolios, vérifier authenticité attestations |

---

## 2. Architecture Technique

### Stack Technologique
```
Frontend:    Next.js 15 (App Router) + React 19 + TypeScript
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
│   ├── admin/             # Dashboard admin (exams, users, monitoring, waitlist)
│   └── api/               # Routes API (auth, exams, submissions, monitoring)
├── components/            # UI Components (exams, auth, anti-cheat)
├── lib/                   # Utilities (auth, rate-limit, anti-cheat, email, csrf)
├── prisma/                # Schema Prisma + migrations
└── docs/                  # Documentation
```

---

## 3. Système Anti-Triche

### 3.1 Protection CSRF
| Détail | Valeur |
|--------|--------|
| **Fichier** | `middleware.ts`, `lib/csrf.ts` |
| **Tokens** | 32 bytes cryptographiques via `crypto.getRandomValues()` |
| **Validation** | Cookie `csrf_token` vs header `x-csrf-token` |
| **Expiration** | 24 heures |
| **Endpoints protégés** | Tous les POST/PUT/DELETE/PATCH (sauf public/auth) |

### 3.2 Rate Limiting (Double Couche)
| Type | Limite | Fenêtre | Fichier |
|------|--------|---------|---------|
| Login | 5 | 15 min | `lib/rate-limit.ts` |
| Register | 3 | 1 heure | `lib/rate-limit.ts` |
| Submission | 5 | 1 heure | `lib/rate-limit.ts` |
| Verify | 10 | 1 heure | `lib/rate-limit.ts` |
| Waitlist | 5 | 1 heure | `lib/rate-limit.ts` |
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

## 6. Gestion des Emails & Waitlist

### 6.1 Modèle Waitlist (NOUVEAU)
```prisma
model Waitlist {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  message   String?
  status    String   @default("PENDING")
  source    String   @default("PORTFOLIO")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 6.2 Page Admin Waitlist
| Détail | Valeur |
|--------|--------|
| **URL** | `/admin/waitlist` |
| **Fichier** | `app/admin/waitlist/page.tsx` |
| **API** | `app/api/admin/waitlist/route.ts` |
| **Fonctionnalités** | Liste, filtres, changement statut, suppression |
| **Statuts** | PENDING, CONTACTED, CONVERTED, REJECTED |

### 6.3 Vérification Email à l'Inscription
**CORRIGÉ:** Les nouveaux inscrits reçoient automatiquement un email de vérification avec :
- Token unique (32 bytes random)
- Expiration: 24 heures
- Lien: `/api/user/verify-email?token=xxx`

---

## 7. Système de Portfolios

### 7.1 API Publique
| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/public/portfolios` | GET | Lister les portfolios activés (recherche, pagination) |
| `/api/public/portfolios/[slug]` | GET | Détails d'un portfolio spécifique (attestations, examens) |

### 7.2 API Utilisateur
| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/user/portfolio` | GET | Récupérer ses infos portfolio |
| `/api/user/portfolio` | PATCH | Configurer slug + activation |

### 7.3 API Admin
| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/admin/users/portfolio` | GET | Lister users avec portfolios |
| `/api/admin/users/portfolio` | PATCH | Modifier slug/enable d'un user |

### 7.4 Page Publique
| Détail | Valeur |
|--------|--------|
| **URL** | `/portfolios` |
| **Fichier** | `app/(public)/portfolios/page.tsx` |
| **Fonctionnalités** | Recherche en temps réel, grille de portfolios, modal waitlist |

---

## 8. Sécurité & Headers

### 8.1 Headers de Sécurité (middleware.ts)
| Header | Valeur | Protection |
|--------|--------|------------|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS legacy |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer control |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | APIs dangereuses |
| `HSTS` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS (prod) |
| `CSP` | `default-src 'self'`, restricted sources | XSS + injection |

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

### 11.1 Problèmes Critiques Corrigés

| # | Problème | Fichier | Solution |
|---|----------|---------|----------|
| **1** | Emails waitlist NON sauvegardés en base | `app/api/waitlist/route.ts` | Ajout modèle Waitlist + `prisma.waitlist.create()` |
| **2** | Pas de rate limiting waitlist | `lib/rate-limit.ts` | Ajout clé `waitlist` (5/heure) |
| **3** | Email auto-vérifié sans vérification | `app/api/auth/register/route.ts` | `emailVerified: null` + envoi email vérification |
| **4** | Pas de sanitization admin users | `app/api/users/route.ts` | Ajout `sanitizeInput()` |
| **5** | Pas de rate limit internship | `app/api/public/internships/route.ts` | Ajout `applyRateLimit()` + Zod schema |

### 11.2 Fichiers Créés/Modifiés

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | ✏️ Modifié | Ajout modèle Waitlist |
| `lib/rate-limit.ts` | ✏️ Modifié | +waitlist, +internship |
| `app/api/waitlist/route.ts` | ✏️ Modifié | Sauvegarde DB + doublons |
| `app/api/auth/register/route.ts` | ✏️ Modifié | Email vérification auto |
| `app/api/users/route.ts` | ✏️ Modifié | Sanitization email |
| `app/api/public/internships/route.ts` | ✏️ Modifié | Rate limit + validation |
| `app/api/admin/waitlist/route.ts` | ✨ Créé | API admin waitlist (GET, PATCH, DELETE) |
| `app/admin/waitlist/page.tsx` | ✨ Créé | Interface admin waitlist |
| `app/api/public/portfolios/route.ts` | ✨ Créé | API publique portfolios |
| `app/api/public/portfolios/[slug]/route.ts` | ✨ Créé | API portfolio par slug |
| `app/api/user/portfolio/route.ts` | ✨ Créé | Config portfolio utilisateur |
| `app/api/admin/users/portfolio/route.ts` | ✨ Créé | Admin gestion portfolios |
| `app/(public)/portfolios/page.tsx` | ✏️ Modifié | Fetch API + grille dynamique |
| `middleware.ts` | ✏️ Modifié | CSRF activé |
| `lib/csrf.ts` | ✨ Créé | Utilitaires CSRF |
| `lib/anti-cheat.ts` | ✨ Créé | Analyse patterns réponses |
| `lib/useExamMonitoring.ts` | ✨ Créé | Hook surveillance examen |
| `app/api/exams/monitoring/route.ts` | ✨ Créé | API monitoring |
| `components/CountdownTimer.tsx` | ✨ Créé | Compte à rebours examens |
| `components/AttestationWatermark.tsx` | ✨ Créé | Watermark anti-falsification |
| `components/exams/form-steps/step-general.tsx` | ✏️ Modifié | Datetime picker + SCHEDULED |
| `components/OfficialDocument.tsx` | ✏️ Modifié | Intégration watermark |

### 11.3 Prochaines Étapes Requises

```bash
# 1. Pousser le modèle Waitlist en base de données
npx prisma db push

# 2. Vérifier que tout fonctionne
npm run build
npm run dev
```

---

## 📞 Support & Maintenance

| Besoin | Action |
|--------|--------|
| Voir les logs de triche | `/admin/monitoring` |
| Gérer la waitlist | `/admin/waitlist` |
| Ajuster les seuils anti-triche | `lib/anti-cheat.ts`, `app/api/exams/[id]/submit/route.ts` |
| Modifier les rate limits | `lib/rate-limit.ts` |
| Changer les emails | `lib/email.ts` |

---

**📄 Document généré automatiquement. Dernière mise à jour : Avril 2026**
