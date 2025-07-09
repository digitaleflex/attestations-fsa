# Documentation du projet attestations-fsa

## 1. Présentation du projet
attestations-fsa est une application web permettant la gestion, la génération et la vérification d’attestations, avec un espace administrateur sécurisé. Elle vise à simplifier la gestion documentaire pour les organismes de formation et à offrir un accès rapide et fiable aux attestations.

**Fonctionnalités principales :**
- Gestion des attestations (création, édition, suppression)
- Génération de documents PDF
- Vérification d’attestations (par code ou QR)
- Espace administrateur (dashboard, statistiques, gestion des utilisateurs)
- Signalement d’anomalies
- Authentification sécurisée

**Public cible :**
- Administrateurs d’organismes de formation
- Utilisateurs souhaitant vérifier une attestation

---

## 2. Prise en main rapide (Quick Start)

### Prérequis
- Node.js >= 18.x
- npm >= 9.x
- Accès à une base de données PostgreSQL

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/digitaleflex/attestations-fsa.git
cd attestations-fsa

# Installer les dépendances
npm install

# Configurer les variables d’environnement
cp .env.example .env
# Modifier .env selon votre configuration

# Appliquer les migrations Prisma
npx prisma migrate deploy

# Lancer le projet en développement
npm run dev
```

### Accès
- Espace public : http://localhost:3000
- Espace admin : http://localhost:3000/admin

---

## 3. Structure du projet

```
attestations-fsa/
├── app/                # Pages Next.js et API routes
├── src/
│   ├── components/     # Composants UI réutilisables
│   ├── hooks/          # Hooks personnalisés
│   ├── lib/            # Fonctions utilitaires, auth, prisma
│   └── types/          # Types TypeScript
├── prisma/             # Modèles et migrations de base de données
├── public/             # Fichiers statiques (images, icônes)
├── docs/               # Documentation du projet
├── package.json        # Dépendances et scripts
└── ...
```

---

## 4. Fonctionnalités détaillées

### Gestion des attestations
- Création, édition, suppression d’attestations via l’espace admin
- Génération automatique de PDF
- Attribution à un utilisateur ou une formation

### Espace administrateur
- Dashboard avec statistiques
- Gestion des utilisateurs, formations, signalements
- Accès restreint par authentification

### Authentification et autorisations
- Système d’authentification sécurisé (NextAuth, JWT, etc.)
- Gestion des rôles (admin, utilisateur)

### Signalements
- Formulaire de signalement d’anomalies
- Suivi des signalements dans l’espace admin

### Vérification d’attestations
- Vérification par code unique ou QR code
- Page dédiée à la vérification

---

## 5. Guide de contribution

### Règles de contribution
- Forker le projet et créer une branche dédiée (`feature/ma-fonctionnalite` ou `docs/ma-section`)
- Commits clairs et descriptifs (convention : type/sujet)
- Ouvrir une Pull Request pour toute modification
- Respecter la structure du code et la documentation

### Exemple de workflow
```bash
git checkout -b feature/ma-fonctionnalite
# Développer...
git add .
git commit -m "feat: ajout de la gestion des certificats"
git push origin feature/ma-fonctionnalite
```

### Tests et validation
- Vérifier que l’application se lance sans erreur
- Relire le code et la documentation avant toute PR

---

## 6. Déploiement

### Déploiement sur Vercel
- La branche `main` est automatiquement déployée sur Vercel
- Les branches de fonctionnalité peuvent être prévisualisées via les Preview Deployments

### Variables d’environnement à configurer
- `DATABASE_URL` : URL de la base PostgreSQL
- `NEXTAUTH_SECRET` : Clé secrète pour l’authentification
- (Voir `.env.example` pour la liste complète)

### Bonnes pratiques
- Ne jamais commiter de secrets ou de données sensibles
- Tester en local avant de fusionner sur `main`

---

## 7. FAQ

**Q : Comment ajouter un nouvel administrateur ?**
R : Utiliser l’espace admin > Utilisateurs > Ajouter.

**Q : Comment réinitialiser la base de données ?**
R : Utiliser Prisma : `npx prisma migrate reset` (attention, cela efface toutes les données).

**Q : Comment signaler un bug ?**
R : Ouvrir un ticket sur GitHub ou utiliser le formulaire de signalement dans l’application.

---

## 8. Annexes

- [Documentation Next.js](https://nextjs.org/docs)
- [Prisma ORM](https://www.prisma.io/docs)
- [Vercel](https://vercel.com/docs)
- [Conventions de commit](https://www.conventionalcommits.org/fr/v1.0.0/)

---

## 9. Historique des versions (Changelog)

- **v1.0.0** : Première release stable
- ...

## 10. Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus d’informations. 