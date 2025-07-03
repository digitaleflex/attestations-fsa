
---

# 📘 Cahier de Projet – Version 1  

## 🐟 Application de Gestion Simplifiée des Attestations  

**Nom du projet :** Attestation Tracker - FSA

---

## 1. 🎯 Objectif principal du projet

Le projet vise à **numériser et structurer l'enregistrement des attestations** délivrées par la **Ferme Agropiscicole St André (FSA)** dans le cadre de ses activités de formation, stages ou certification.

> 🔍 Cette première version (**V1**) ne génère pas encore les attestations au format PDF mais enregistre toutes les informations importantes dans une **base de données**, avec un **identifiant unique sécurisé**.

---

## 2. 👥 Public cible

- **Administrateur de la ferme** (formateur, gestionnaire ou responsable administratif)
- ❌ Aucun accès prévu pour les bénéficiaires dans la V1
- 🔒 Accès au backoffice restreint et sécurisé à **un seul compte admin**

---

## 3. 🔐 Accès et sécurité

- 🔐 Interface de connexion sécurisée (**email + mot de passe hashé**)
- 💾 Stockage des identifiants admin dans une table dédiée (`Admin`)
- 🚧 L'accès aux fonctionnalités est **réservé à l'utilisateur admin authentifié**

---

## 4. 🔎 Fonctionnalités de la Version 1

### 🧾 Gestion des attestations

| Fonction                      | Détail                                                                 |
|-----------------------------|------------------------------------------------------------------------|
| ➕ Ajouter une attestation    | Saisie manuelle d’un formulaire avec les données du bénéficiaire       |
| 📚 Lister les attestations   | Tableau des attestations déjà créées avec tri par date, formation, nom |
| 🏷 Générer un identifiant unique (code) | Format : `FSA-AAAA-MM-XXXXX-HHHHH`                                      |
| ✅ Statut de l’attestation   | Valeurs possibles : `PENDING`, `VALIDATED`, `REJECTED`                 |
| 📌 Association à une formation | Chaque attestation est liée à une entrée dans la table `Formation`     |
| 🕓 Historique des émissions | Date de création et autres métadonnées stockées pour chaque entrée     |

### 👤 Gestion admin

| Fonction                     | Détail                                               |
|----------------------------|------------------------------------------------------|
| 🔐 Connexion admin          | Formulaire de login + session persistante            |
| 👤 Création d’un compte admin initial | Via script seed ou migration                         |

---

## 5. 📦 Structure des données

### 🗃 Tables principales

- `Admin` – Pour le compte d'administration
- `Formation` – Pour le catalogue des formations proposées
- `Attestation` – Pour chaque document enregistré
- `AttestationStatus` – Enumération des statuts possibles

### 📌 Format de code d’attestation

```
FSA-2025-M07-00012-3f8b6
```

- `FSA` : Acronyme de la ferme  
- `2025` : Année  
- `M07` : Mois (juillet)  
- `00012` : Numéro séquentiel formaté  
- `3f8b6` : Hash court ou UID aléatoire pour unicité

---

## 6. ⚙️ Stack technique choisie

| Élément             | Technologie                    |
|---------------------|--------------------------------|
| Frontend            | Next.js + TailwindCSS         |
| Backend API         | Next.js API routes            |
| ORM / DB            | Prisma + PostgreSQL           |
| Auth                | Session custom (pas NextAuth) |
| Hash                | bcrypt                        |
| UID                 | nanoid ou uuid                |
| Déploiement         | Docker sur serveur privé      |

---

## 7. 🚧 Fonctionnalités prévues pour les versions futures

| Version | Fonctionnalité prévue                                  |
|--------|--------------------------------------------------------|
| V2     | Génération automatique de PDF                          |
| V2     | Ajout de QR code pour vérification                     |
| V2     | Interface publique de vérification par code            |
| V3     | Gestion multi-admin avec rôles                         |
| V3     | Envoi de l’attestation par email au bénéficiaire       |
| V4     | Historique complet des éditions / modification         |
| V4     | Dashboard statistiques des formations / attestations   |

---

## 8. 📁 Arborescence simplifiée (projet Next.js)

```bash
app/
├── layout.tsx                  # Layout global
├── page.tsx                    # Page d'accueil
├── admin/
│   ├── login/
│   │   └── page.tsx            # Page de login
│   ├── dashboard/
│   │   └── page.tsx            # Tableau de bord
│   └── attestations/
│       ├── new/
│       │   └── page.tsx        # Formulaire d’ajout d’attestation
│       └── list/
│           └── page.tsx        # Liste des attestations
```

```

prisma shema  

// 🎯 Générateur du client Prisma
generator client {
  provider = "prisma-client-js"
}

// 🗃️ Source de données : PostgreSQL via variable d’environnement
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

//
// 📘 ENUMS
//

// ✅ Statut de l’attestation
enum AttestationStatus {
  PENDING      // En attente de validation
  VALIDATED    // Attestation validée
  REJECTED     // Attestation refusée ou annulée
}

// ✅ Type d’attestation délivrée
enum AttestationType {
  FORMATION       // Attestation de formation
  STAGE           // Attestation de stage
  CERTIFICATION   // Certificat officiel
}

//
// 👤 Utilisateur Admin (Backoffice uniquement)
//

model Admin {
  id        String   @id @default(uuid())       // ID unique
  email     String   @unique                    // Email de connexion
  password  String                              // Mot de passe hashé avec bcrypt
  name      String?                             // Nom de l’admin (optionnel)
  createdAt DateTime @default(now())            // Date de création du compte
}

//
// 🎓 Formation
//

model Formation {
  id           String       @id @default(uuid())  // ID unique
  name         String                               // Nom de la formation
  category     String                               // Catégorie (ex : aquaculture, transformation, etc.)
  description  String?                              // Description facultative
  skills       String[]                             // Compétences acquises (array de string)
  createdAt    DateTime     @default(now())         // Date de création

  // 🔗 Relation : Une formation peut avoir plusieurs attestations
  attestations Attestation[]
}

//
// 📄 Attestation
//

model Attestation {
  id             String            @id @default(uuid())   // ID unique
  code           String            @unique                // Code formaté : FSA-2025-M07-00001-3f8b6
  issuedAt       DateTime          @default(now())        // Date d’émission

  // 🏷 Type d’attestation
  type           AttestationType   @default(FORMATION)    // Par défaut : FORMATION

  // 👤 Informations du bénéficiaire
  fullName       String                                    // Nom complet
  birthDate      DateTime                                  // Date de naissance
  birthPlace     String                                    // Lieu de naissance

  // 📚 Détails de la formation suivie
  formationId    String
  formation      Formation         @relation(fields: [formationId], references: [id])

  startDate      DateTime                                   // Date de début de la formation
  endDate        DateTime                                   // Date de fin
  location       String                                     // Lieu de la formation
  instructor     String                                     // Nom du formateur

  // 🏢 Informations administratives
  issuingCompany String                                     // Nom de l'organisation ou entreprise délivrant
  status         AttestationStatus  @default(PENDING)       // Statut de validation
  pdfUrl         String?                                    // URL du PDF généré (optionnel en V1)
}

}
```

---

# 🚀 Stack Technique Officielle – Projet Attestation FSA V1

---

## ⚙️ **Frontend + Backend unifiés avec Next.js 15**

| Élément          | Choix technique                                | Rôle principal                     |
| ---------------- | ---------------------------------------------- | ---------------------------------- |
| **Framework**    | [Next.js 15](https://nextjs.org/) (App Router) | Frontend + API dans une seule base |
| **Langage**      | TypeScript                                     | Sécurité de typage, maintenabilité |
| **UI Framework** | Tailwind CSS                                   | Design rapide, propre, responsive  |
| **Formulaire**   | React Hook Form + Zod                          | Validation robuste et UX fluide    |
| **Charting**     | Chart.js (via `react-chartjs-2`)               | Graphiques simples (V2+)           |
| **Icons**        | Lucide ou Heroicons                            | Icônes modernes, SVG natifs        |

---

## 🧩 **Base de données et ORM**

| Élément             | Choix technique                      | Rôle principal                                   |
| ------------------- | ------------------------------------ | ------------------------------------------------ |
| **Base de données** | PostgreSQL                           | SQL robuste, typé, fiable                        |
| **ORM**             | [Prisma ORM](https://www.prisma.io/) | Modélisation simple, migrations, requêtes typées |
| **UUID / ID**       | `uuid()` / `autoincrement()`         | Génération d’identifiants propres                |

---

## 🔐 **Sécurité et Authentification**

| Élément               | Choix technique                                   | Rôle principal                   |
| --------------------- | ------------------------------------------------- | -------------------------------- |
| **Auth admin**        | Session personnalisée avec `bcrypt`               | Connexion au backoffice          |
| **Hash mot de passe** | `bcrypt`                                          | Sécurisation du login            |
| **Gestion d’accès**   | Middleware custom Next.js                         | Protection des routes `/admin/*` |
| **CSRF/XSS**          | Automatiquement géré par Next.js + validation Zod | Sécurité de base                 |

---

## 🔗 **Identifiants & Génération unique**

| Élément                | Choix technique                                         | Rôle                                                  |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **Code d’attestation** | Construction manuelle (ex : `FSA-2025-M07-00012-3fa98`) | Identifiant humain vérifiable                         |
| **UID aléatoire**      | [`nanoid`](https://github.com/ai/nanoid)                | Génération de hash court unique pour code attestation |

---

## 🧪 **Tests & Validation**

| Élément                   | Choix technique                | Utilité                           |
| ------------------------- | ------------------------------ | --------------------------------- |
| **Validation formulaire** | `Zod`                          | Validation côté client et backend |
| **Tests unitaires**       | (optionnel) `Vitest` ou `Jest` | Pour les évolutions futures       |

---

## 📦 **Outils de développement**

| Élément                     | Choix technique       | Rôle                                |
| --------------------------- | --------------------- | ----------------------------------- |
| **Dev Server**              | `next dev` via Docker | Dev local rapide et cohérent        |
| **Lint / Format**           | ESLint + Prettier     | Code propre, uniforme               |
| **Gestion des scripts**     | `pnpm`                | Lancement et gestion des paquets    |
| **Monorepo possible (V2+)** | Turborepo (optionnel) | Pour séparer API / UI dans le futur |

---

## 🐳 **Conteneurisation & Hébergement**

| Élément              | Choix technique                  | Rôle                            |
| -------------------- | -------------------------------- | ------------------------------- |
| **Docker**           | Conteneurisation                 | Déploiement facile sur ton VPS  |
| **Reverse Proxy**    | Nginx ou Traefik (optionnel)     | Pour sécuriser avec HTTPS       |
| **Database Hosting** | PostgreSQL local ou en conteneur | Gestion autonome ou cloud local |
| **vercel**           | PostgreSQL                       | plus simple et facile  |

---

## ✨ Résumé visuel (Stack complet)

```
🌐 Next.js 15 (App Router)
├── TailwindCSS
├── React Hook Form + Zod
├── Prisma + PostgreSQL
├── bcrypt + middleware auth
├── nanoid pour identifiants
├── Chart.js (V2)
└── Docker (Full stack containérisé)
```

---

## 📌 Pourquoi cette stack est idéale pour toi, Eurin ?

| Besoin                       | Solution choisie                            |
| ---------------------------- | ------------------------------------------- |
| Simplicité de déploiement    | Next.js + Docker monolithique               |
| Faible coût d'infrastructure | PostgreSQL local via conteneur              |
| Admin unique, sécurisé       | Auth personnalisée simple & fiable          |
| Application évolutive        | Prisma + App Router + composants modulaires |
| Responsive + UX propre       | TailwindCSS                                 |

---
