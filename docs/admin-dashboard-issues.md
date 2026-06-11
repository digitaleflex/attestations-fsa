# Issues Locales - Refonte Dashboard Admin

Ce fichier trace les problèmes architecturaux et de performance identifiés sur le Dashboard Administrateur (`app/admin/dashboard/page.tsx`) et leur résolution séquentielle.

## 🚨 Critiques (Bloquants pour la scalabilité)

- [ ] **ISSUE-1: Data Fetching Massif (OOM Risk)**
  - **Problème** : Le frontend télécharge toute la table `User` et `Report` pour faire un `.length` en JavaScript. Va faire crasher le client avec > 1000 entrées.
  - **Solution** : Créer un endpoint agrégé `/api/admin/dashboard/overview` utilisant `prisma.count()` pour toutes les statistiques principales.

## 🟠 Hautes (Performance et Architecture)

- [ ] **ISSUE-2: API Waterfall & Redondance**
  - **Problème** : 6 appels réseaux distincts au montage du composant, dont 2 doublons sur `/api/users`.
  - **Solution** : Grouper toutes les métriques requises par le composant racine via l'endpoint créé dans ISSUE-1.

- [ ] **ISSUE-3: Architecture Monolithique ("use client")**
  - **Problème** : Toute la page est un composant client, perdant les avantages des Server Components (RSC) et alourdissant le First Load.
  - **Solution** : Transformer `page.tsx` en Server Component. Faire l'appel de données initial sur le serveur et le passer aux composants enfants.

- [ ] **ISSUE-4: Bundle Bloat dû à Chart.js**
  - **Problème** : Import statique de la librairie graphique très lourde `chart.js` au chargement initial de la page.
  - **Solution** : Extraire les graphiques et utiliser `next/dynamic` pour un lazy-loading asynchrone (code splitting).

## 🟡 Moyennes (UX et Robustesse)

- [ ] **ISSUE-5: Hydration Mismatch (Hack "mounted")**
  - **Problème** : Scintillement de l'UI lors de l'affichage de la date courante.
  - **Solution** : Générer la date côté serveur et la passer en prop statique.

- [ ] **ISSUE-6: Gestion Silencieuse des Erreurs (Silent Failures)**
  - **Problème** : En cas d'erreur API, les compteurs affichent `0` au lieu d'indiquer une erreur technique.
  - **Solution** : Ajouter une gestion d'erreur visuelle (Error Boundary local ou gestion d'état explicite pour les requêtes React Query).
