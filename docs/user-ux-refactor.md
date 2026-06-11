# Plan de Refonte Neuro-Ergonomique (User UI)

Objectif : Transformer l'espace candidat, actuellement pensé comme une base de données (11 menus), en un "Golden Path" pédagogique clair et actionnable (4/5 menus). Réduire drastiquement le poids du bundle initial pour les utilisateurs mobiles.

## 📋 ISSUES LOG (À traiter séquentiellement)

### PHASE 1 : Architecture de Navigation (Le "Golden Path" Étudiant)
- [ ] **USER-UX-1 : Refonte de la Sidebar (`app/(user)/layout.tsx`)**
  - Réduire les 11 liens actuels à 4/5 liens majeurs :
    1. **Tableau de bord** (`/dashboard`)
    2. **Mon Apprentissage** (`/courses`) -> Fusionnera plus tard les examens blancs et officiels.
    3. **Mes Certifications** (`/attestations`) -> Fusionnera plus tard les résultats et relevés.
    4. **Stages & Projets** (`/internships`)
    5. **Mon Espace** (`/profile`) -> Inclura le support.
  - Conserver les notifications dans le header.

### PHASE 2 : Le Dashboard "Fast-Load" (Performance Mobile)
- [ ] **USER-UX-2 : Nettoyage du Dashboard (`app/(user)/dashboard/page.tsx`)**
  - Passer le composant en Server Component (RSC).
  - Extraire la logique de `html2pdf.js` et de `Chart.js` dans des composants chargés dynamiquement (Lazy Loading) ou les supprimer si jugés inutiles pour la vue d'ensemble.
  - Déplacer la logique massive de `claimCode` (Lier un dossier) vers le Profil, ou la réduire à une simple bannière conditionnelle.
  - Mettre en avant 2 choses vitales : L'état actuel (ex: "Examen dans 2 jours") et la dernière action accomplie.

### PHASE 3 : Fusion des Outils d'Apprentissage
- [ ] **USER-UX-3 : Création du Hub Apprentissage**
  - Fusionner visuellement les pages `/exams` et `/mock-exams` à l'intérieur de `/courses` en utilisant des onglets (Tabs). L'étudiant trouve son cours, ses révisions et son examen au même endroit.

### PHASE 4 : Fusion des Accomplissements
- [ ] **USER-UX-4 : Création du Hub Certifications**
  - Fusionner les vues `/results`, `/transcript`, et `/attestations` dans une seule page puissante. L'étudiant y voit ses notes et télécharge ses PDF sans chercher dans 3 menus différents.

### PHASE 5 : Nettoyage du Code Mort
- [ ] **USER-UX-5 : Suppression des Routes Orphelines**
  - Supprimer les anciens dossiers (`/exams`, `/mock-exams`, `/results`, `/transcript`, `/support`) une fois fusionnés pour alléger la codebase.
