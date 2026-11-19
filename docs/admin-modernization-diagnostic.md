# Diagnostic — Modernisation de l'interface administrative (Série 1)

## 1. Stack technique

- **Framework** : Next.js 16 (App Router), React 19
- **Langage** : TypeScript 5.9
- **Styles** : Tailwind CSS 4, Shadcn/UI (Radix)
- **ORM** : Prisma 6.19
- **Auth** : Better Auth 1.7
- **Icônes** : Lucide React
- **Notifications** : Sonner
- **État** : React hooks (useState/useEffect/useCallback), URL comme source de vérité (searchParams)

## 2. Architecture existante

### Layout admin (`app/admin/layout.tsx`)
- Server Component avec SidebarProvider (Shadcn)
- AdminSidebar + AdminBreadcrumbs + NotificationCenter + AdminCommandPalette
- Auth check via `auth.api.getSession` + `isAdminUser` + `enforceAccountStatus`
- Fond slate-50, header sticky blanc

### Page Apprenants (`app/admin/users/page.tsx`) — 1664 lignes
- Client Component monolithique
- Filtres via URL (searchParams) comme source de vérité partageable
- Debounce 500ms sur la recherche
- Pagination côté serveur (API `/api/users`)
- Tri par colonnes (nom, email, createdAt, updatedAt)
- Sélection multiple + actions groupées (suspendre, réactiver, supprimer)
- Vue desktop (tableau) + vue mobile (cartes)
- Dialog de création/modification d'utilisateur
- Dialog de détails (thème sombre slate-900)
- Dialog d'affectation à un examen
- AlertDialog de confirmation de suppression (avec confirmation email pour les admins)

### Composants réutilisables (`components/admin/users/`)
- `UsersFilterBar` — filtres recherche/statut/rôle/vérification/période
- `UsersTableSkeleton` — skeleton de chargement
- `UserBadges` — StatusBadge, RoleBadge, VerifiedBadge
- `UserActionsMenu` — menu contextuel par utilisateur
- `UsersBulkBar` — barre d'actions groupées

### API (`app/api/users/route.ts`, `app/api/users/[id]/route.ts`)
- GET avec pagination, filtres, tri côté serveur
- POST création
- PATCH modification (statut, rôle, infos, examen, reset password)
- DELETE suppression

## 3. Fonctionnalités existantes (déjà en place)

| Fonctionnalité | État |
|---|---|
| Recherche par nom/email | ✅ (debounce 500ms) |
| Filtres statut/rôle/vérification/période | ✅ |
| Tri par colonnes | ✅ |
| Pagination | ✅ |
| Sélection multiple | ✅ |
| Actions groupées (suspendre/réactiver/supprimer) | ✅ |
| Vue responsive (tableau + cartes) | ✅ |
| Création/modification utilisateur | ✅ (Dialog) |
| Profil détaillé | ✅ (Dialog sombre) |
| Affectation à un examen | ✅ (Dialog) |
| Réinitialisation mot de passe | ✅ |
| Audit logs par utilisateur | ✅ |
| Résultats d'examen par utilisateur | ✅ |
| Skeleton loader | ✅ |
| Empty state / Error state | ✅ |
| Confirmation de suppression (email pour admins) | ✅ |

## 4. Problèmes UX/UI et incohérences

### 4.1 Incohérence visuelle majeure
- Le Dialog de détails utilise un thème **sombre** (`bg-slate-900`, `text-white`) tandis que tout le reste de l'admin est **clair** (`bg-white`, `text-slate-800`). Cela crée une rupture visuelle brutale.

### 4.2 Monolithisme
- La page fait **1664 lignes** dans un seul fichier. La logique (fetch, filtres, formulaires, dialogs) est mélangée. Difficile à maintenir et à tester.

### 4.3 Pas de cartes statistiques
- Le prompt demande 4 cartes de synthèse (total, actifs, vérifiés, non vérifiés). Actuellement, seul le total est affiché dans le sous-titre (`meta.total`).

### 4.4 Pas de fil d'Ariane dans l'en-tête de page
- Le layout a `AdminBreadcrumbs` dans le header global, mais la page users a sa propre nav (`Tous les utilisateurs` / `Demandes de stage`). Pas de breadcrumb contextuel.

### 4.5 Formulaire de création dans un Dialog
- Le formulaire d'ajout/modification est dans un `Dialog` avec `max-h-[70vh]`. Sur mobile, cela peut être inconfortable. Un Sheet ou une page dédiée serait plus adapté.

### 4.6 Palette de couleurs non standardisée
- Le prompt définit une palette précise (#F8FAFC, #172033, #DC2626, etc.). Le code utilise des classes Tailwind génériques (`slate-800`, `brand`, etc.) qui peuvent dériver de cette palette mais sans tokens explicites.

### 4.7 Pas de recherche globale dans le header
- Le prompt demande un accès à la recherche globale dans le header. Le command palette existe (`AdminCommandPalette`) mais n'est pas mis en avant.

### 4.8 Tableau desktop avec scroll horizontal
- Le tableau a `min-w-[1080px]` avec `overflow-x-auto`. Sur tablette, cela force un scroll horizontal. Le prompt demande une gestion des colonnes sur petits écrans.

### 4.9 Pas de colonne "Dernière activité" claire
- La colonne "Activité" affiche `updatedAt` formaté en date. Le prompt demande "Date ou état disponible". C'est acceptable mais pourrait être amélioré avec un indicateur de présence.

### 4.10 Incohérence des dialogs
- Le Dialog de détails est sombre, le Dialog de création est clair, le Dialog d'affectation est clair. Trois styles différents pour des modales similaires.

## 5. Risques techniques

| Risque | Impact |
|---|---|
| Page monolithique (1664 lignes) | Maintenance difficile, régression probable lors de modifications |
| Logique métier mélangée avec l'UI | Difficile à tester unitairement |
| Pas de tests E2E pour la page users | Régression non détectée |
| Dépendance aux searchParams pour les filtres | Complexité de synchronisation URL/état |
| Pas de cache côté client (React Query) | Rechargements inutiles |

## 6. Opportunités d'amélioration

1. **Extraire la logique en hooks** : `useUsers`, `useUserFilters`, `useUserActions` pour séparer la logique de l'UI.
2. **Extraire les dialogs en composants** : `UserCreateDialog`, `UserDetailDialog`, `UserAssignDialog`.
3. **Standardiser le thème des dialogs** : tout en clair, avec la palette institutionnelle.
4. **Ajouter des cartes statistiques** : total, actifs, vérifiés, non vérifiés (via une API ou calcul côté client).
5. **Améliorer le responsive** : transformer le tableau en cartes sur mobile (déjà fait) et gérer les colonnes sur tablette.
6. **Ajouter un fil d'Ariane contextuel** dans l'en-tête de page.
7. **Créer des tokens CSS** pour la palette de couleurs (variables CSS).
8. **Mettre en avant le command palette** dans le header.
9. **Ajouter des tests** : tests unitaires pour les hooks, tests E2E pour les flux critiques.

## 7. Plan d'exécution détaillé

### Série 1 — Audit et cartographie ✅ (ce document)
- Exploration du code, diagnostic, plan.

### Série 2 — Fondations UI
- Créer des tokens CSS pour la palette institutionnelle (variables dans globals.css).
- Standardiser la typographie (Inter/Geist déjà présent via Plus_Jakarta_Sans).
- Créer un composant `StatCard` réutilisable.
- Créer un composant `PageHeader` avec breadcrumb + titre + description + action.

### Série 3 — Layout administratif
- Améliorer la sidebar : catégorisation des menus, état actif plus visible.
- Mettre en avant le command palette dans le header.
- Améliorer le responsive de la sidebar (déjà rétractable).

### Série 4 — Page Apprenants
- Extraire la logique en hooks (`useUsers`, `useUserFilters`).
- Extraire les dialogs en composants séparés.
- Standardiser le thème des dialogs (clair).
- Ajouter les cartes statistiques.
- Ajouter le fil d'Ariane contextuel.
- Améliorer la gestion des colonnes sur tablette.
- Ajouter un indicateur de présence ("dernière activité" plus clair).

### Série 5 — Expérience utilisateur
- Standardiser les états de chargement (skeleton déjà présent).
- Améliorer les états vides (déjà présent).
- Améliorer l'accessibilité (aria-labels déjà présents).
- Ajouter des animations subtiles (transitions CSS).

### Série 6 — Vérifications
- Tests fonctionnels (E2E pour les flux critiques).
- Tests responsive (mobile, tablette, desktop).
- Vérification des permissions (déjà en place côté serveur).
- Build de production.

## 8. Commits prévus

1. `refactor(ui): establish admin design tokens`
2. `feat(admin): add StatCard and PageHeader components`
3. `feat(admin): redesign user detail dialog (light theme)`
4. `refactor(admin): extract user page logic into hooks`
5. `refactor(admin): extract user dialogs into components`
6. `feat(admin): add stats cards to learners page`
7. `feat(admin): improve responsive table columns`
8. `test(admin): add E2E coverage for learners page`

## 9. Risques de régression

- La page users est le point d'entrée principal pour la gestion des apprenants. Toute modification doit préserver les fonctionnalités existantes.
- Les dialogs sont complexes (création, détails, affectation, suppression). L'extraction en composants doit préserver le comportement.
- Les filtres via URL sont la source de vérité. Ne pas casser la synchronisation.
- Les actions groupées (suspendre, réactiver, supprimer) sont critiques. Tester après modification.

## 10. Décisions techniques

- **Ne pas changer de framework** : Next.js + React + Tailwind + Shadcn restent.
- **Ne pas ajouter de bibliothèque** : pas de React Query pour l'instant (éviter la suringénierie). Utiliser les patterns existants.
- **Préserver les fonctionnalités** : toutes les actions existantes (créer, modifier, supprimer, suspendre, affecter, reset password, audit, résultats) doivent rester fonctionnelles.
- **Approche incrémentale** : commencer par les fondations (tokens, composants), puis les dialogs, puis la page.
