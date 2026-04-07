# 🔴 Audit Complet du Projet - Points d'Attention

## Résumé Général

- **Total de code**: ~41,634 lignes (TypeScript/TSX)
- **Framework**: Next.js 16.2.2 avec Turbopack
- **Base de données**: PostgreSQL + Prisma
- **Authentification**: Better Auth
- **Statut**: En production

---

## 🚨 Points Critiques (À traiter en priorité)

### 1. **369 utilisations de `any`** (CRITIQUE)

Le code contient 369 utilisations de `any` qui nuisent à la sécurité des types.

- **Impact**: Perte de sécurité type, bugs potentiels difficiles à détecter
- **Fichiers affectés**: Presque tous les fichiers de l'application
- **Action**: Refactoriser progressivement avec des types appropriés

### 2. **Sanitization incomplète** (CRITIQUE)

- `lib/sanitization.ts` existe mais n'est pas utilisé systématiquement
- Risque d'injection XSS dans les entrées utilisateur non nettoyées
- **Action**: Appliquer la sanitization sur TOUTES les entrées utilisateur

### 3. **Modèle `Admin` dupliqué** (CRITIQUE)

- Le schéma Prisma contient un modèle `Admin` (lignes 424-437) qui semble être un résidu legacy
- Better Auth utilise déjà le modèle `User` avec rôles
- **Action**: Supprimer le modèle `Admin` superflu

### 4. **SecurityLog non utilisé efficacement**

- Le système de `SecurityLog` est crée mais pas exploité pleinement
- Pas de tableaux de bord de sécurité pour les admins
- **Action**: Créer une interface de monitoring des événements de sécurité

---

## ⚠️ Points Importants

### 5. **Rate Limiting désactivé si Redis non configuré**

- Le code retourne `{ allowed: true }` si Upstash n'est pas configuré
- En production, si les variables Redis ne sont pas set, aucune protection
- **Vérifier**: Que `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` sont configurés en prod

### 6. **Email service dégradé si pas de clé API**

- `lib/email.ts` crée une instance Resend avec "disabled_key" si pas de clé
- Les emails ne partiront pas mais pas d'erreur explicite
- **Action**: Ajouter une validation au démarrage si pas de clé en prod

### 7. **1 seul TODO trouvé**

- `app/api/user/attestations/[id]/correction/route.ts:52` - Notification aux admins non implémentée

### 8. **Pas de tests unitaires significatifs**

- `lib/utils.test.ts` existe mais semble basique
- Pas de tests pour les API routes
- Pas de tests pour les composants React critiques
- **Action**: Ajouter une suite de tests complète

---

## 📊 État des Fonctionnalités

| Module                       | Avancement | Status         |
| ---------------------------- | ---------- | -------------- |
| Authentication (Better Auth) | 100%       | ✅ Production  |
| Gestion Exams                | 90%        | ✅ Production  |
| Attestations                 | 85%        | ⚠️ Améliorable |
| Résultats/Transcripts        | 80%        | ✅ Production  |
| Stages                       | 75%        | ⚠️ Incomplet   |
| Admin Dashboard              | 95%        | ✅ Production  |
| Pages Publiques              | 90%        | ✅ Production  |
| Notifications                | 70%        | ⚠️ Partiel     |
| Contact/Support              | 80%        | ✅ Production  |
| Chat                         | 60%        | 🔴 Incomplet   |
| Ressources                   | 75%        | ✅ Production  |
| Anti-Cheat                   | 70%        | ⚠️ Partiel     |
| Audit Logging                | 65%        | 🔴 Partiel     |
| Sécurité                     | 80%        | ✅ Production  |

---

## 🔍 Problèmes de Sécurité

### 9. **Trusted Origins trop permissifs**

```typescript
"https://*.vercel.app"; // Trop large - permet tout subdomain
```

- **Risque**: Attaque depuis un subdomain malveillant
- **Action**: Limiter aux domaines spécifiques

### 10. **Session durée longue (30 jours)**

- 30 jours de session sans refresh peut être risqué
- **Recommandation**: Réduire à 7-14 jours avec refresh automatique

### 11. **Pas de CSRF explicite**

- Le fichier `lib/csrf.ts` existe mais l'implémentation n'est pas visible
- **Vérifier**: Que la protection CSRF est active sur les mutations

---

## 🏗️ Problèmes Architecturaux

### 12. **Code dupliqué**

- Plusieurs fichiers ont des-logiques similaires dupliquées
- Ex: génération de code d'attestation copiée dans plusieurs routes

### 13. **Pas de middleware global pour les logs**

- Chaque route appelle `createAuditLog()` manuellement
- **Action**: Créer un middleware automatique

### 14. **Images/logo hardcodés dans les emails**

```typescript
<img src="${APP_URL}/logo-fsa.png" alt="FSA" />
```

- Si le logo n'existe pas, les emails sont cassés
- **Action**: Utiliser une URL absolue vérifiable

---

## 📝 Checklist des Actions Prioritaires

### Aujourd'hui (P0)

- [ ] Configurer Upstash Redis en production
- [ ] Mettre `AUTH_SECRET` en production (pas de fallback dev)
- [ ] Vérifier que `RESEND_API_KEY` est configuré
- [ ] Supprimer le modèle `Admin` dupliqué dans Prisma

### Cette semaine (P1)

- [ ] Remplacer les `any` dans les fichiers critiques (API routes)
- [ ] Renforcer la sanitization sur toutes les entrées
- [ ] Ajouter des tests pour les fonctionnalités critiques
- [ ] Limiter les trusted origins

### Ce mois (P2)

- [ ] Implémenter un dashboard de sécurité
- [ ] Compléter le système d'audit logging automatique
- [ ] Terminer le système de chat
- [ ] Améliorer la détection de triche (coté client)

---

## 📁 Structure du Projet

```
attestations-fsa/
├── app/                    # Pages Next.js (App Router)
│   ├── (public)/           # Pages publiques
│   ├── (user)/            # Pages utilisateur connecté
│   ├── admin/             # Pages admin
│   └── api/               # API routes (80+ endpoints)
├── components/            # Composants React
│   ├── ui/                # Composants UI (Radix)
│   ├── exams/             # Composants exam
│   └── admin/             # Composants admin
├── lib/                   # Librairies et utilitaires
│   ├── auth.ts            # Configuration Better Auth
│   ├── prisma.ts          # Client Prisma
│   ├── email.ts           # Service email (Resend)
│   ├── notifications.ts   # Notifications (Pusher)
│   ├── rate-limit.ts      # Rate limiting (Upstash)
│   ├── anti-cheat.ts      # Détection triche
│   └── audit.ts           # Audit logging
├── prisma/
│   └── schema.prisma      # Schéma de base de données
└── doc/                   # Documentation (récemment créée)
```

---

## 🔧 Technologies Utilisées

| Catégorie       | Technologie                |
| --------------- | -------------------------- |
| Framework       | Next.js 16.2.2             |
| Auth            | Better Auth 1.2.12         |
| Base de données | PostgreSQL + Prisma 6.11.1 |
| UI              | Radix UI + Tailwind CSS 4  |
| Temps réel      | Pusher                     |
| Rate Limiting   | Upstash Redis              |
| Email           | Resend                     |
| PDF             | jsPDF, html2pdf.js         |
| Validation      | Zod                        |
| État            | React Query (TanStack)     |

---

## 📌 Notes

1. Le projet est bien structuré et fonctionne en production
2. La documentation vient d'être créée dans `doc/`
3. Certaines fonctionnalités sont partiellement implémentées (chat, audit)
4. Le type安全工作 est le plus grand challenge (369 x `any`)

---

_Audit effectué le 7 Avril 2026_
