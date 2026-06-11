# Plan de Refonte Neuro-Ergonomique (Admin UI)

Objectif : Éliminer la surcharge cognitive (Loi de Hick), fusionner les vues par intention utilisateur (Action vs Analyse), et nettoyer le dashboard des métriques non-actionnables.

## 👥 Force de Frappe Recommandée (Agents)

Pour exécuter cette refonte efficacement et en parallèle, voici la répartition idéale des agents Gemini :

1.  **`@ui-ux-design-pro`** (Le Lead) : Pour concevoir la nouvelle architecture du menu et la vue ultra-minimaliste du Dashboard. Il s'occupera du *layout* et du composant racine.
2.  **`@frontend-design`** (L'Exécutant UI) : Pour intégrer les nouveaux composants fusionnés (ex: La nouvelle "Inbox" unique pour les messages et signalements).
3.  **`@code-simplifier`** (Le Nettoyeur) : Pour supprimer de la base de code tous les fichiers de routing devenus obsolètes après les fusions (ex: supprimer les dossiers `app/admin/stats`, `app/admin/otp-logs` etc.).

---

## 📋 ISSUES LOG (À traiter séquentiellement)

### PHASE 1 : Architecture de Navigation (Le "Golden Path")
- [ ] **UX-1 : Refonte de la Sidebar (`app/admin/components/AdminSidebar.tsx`)**
  - Réduire les 20 liens actuels à 6 liens majeurs (Dashboard, À Traiter, Messagerie, Apprenants, Pédagogie, Attestations) + 1 Settings.
  - Supprimer les groupes de menu imbriqués qui ajoutent de la charge mentale.

### PHASE 2 : Le Dashboard "Action-First"
- [ ] **UX-2 : Nettoyage du Dashboard (`app/admin/dashboard/page.tsx`)**
  - Supprimer les graphiques complexes (Chart.js / Line / Doughnut / Bar) de la vue d'atterrissage.
  - Implémenter le bloc "Message Cognitif" ("Bonjour, vous avez X tâches en attente").
  - Créer le composant "Actions Prioritaires" (Boutons directs vers les tâches urgentes).
  - Conserver uniquement 3 KPIs vitaux sur une seule ligne.

### PHASE 3 : Fusion des Outils (Inbox Zero)
- [ ] **UX-3 : Création du Action Center ("À Traiter")**
  - Créer une nouvelle page `/admin/tasks` (ou fusionner dans `/admin/dashboard`).
  - Regrouper visuellement : Copies à corriger + Portfolios à valider + Demandes de correction profil.
  
- [ ] **UX-4 : Création de la Boîte de Réception Unique ("Messagerie")**
  - Créer une vue unifiée pour les Messages internes, les Contacts (RDV) et les Signalements.
  - Permettre un traitement rapide (Marquer comme lu / Archiver).

### PHASE 4 : Restructuration des Données
- [ ] **UX-5 : Fusion Apprenants / CRM**
  - Intégrer les vues "Liste d'attente" et "Stages" sous forme de filtres/onglets dans la page principale "Utilisateurs".
  
- [ ] **UX-6 : Regroupement Pédagogique**
  - Intégrer la gestion des Examens, Ressources et Configurations de missions à l'intérieur de la vue "Formations".

### PHASE 5 : Nettoyage du Code Mort
- [ ] **UX-7 : Suppression des Routes Orphelines**
  - Supprimer les dossiers Next.js devenus inutiles (ex: `admin/stats`, `admin/logs`, etc. seront déplacés sous `admin/settings`).
