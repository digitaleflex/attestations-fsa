# 🔐 Comptes et Authentification - FSA

## 📋 Vue d'ensemble

Le système d'authentification de la **Ferme St André (FSA)** gère deux types d'utilisateurs distincts :

| Type | Modèle | Rôle | Accès |
|------|--------|------|-------|
| **Administrateur** | `Admin` | `ADMIN` | Backoffice complet |
| **Candidat** | `User` | `USER` | Espace candidat limité |

---

## 👤 Comptes Administrateur

### 🔑 Compte Principal (Production)

| Information | Valeur |
|-------------|--------|
| **Email** | `admin@fsa.bj` |
| **Mot de passe** | `Admin123!` |
| **Rôle** | `ADMIN` |
| **Modèle** | `Admin` |
| **URL de connexion** | `/admin/login` |

### 🧪 Compte de Test (Développement)

| Information | Valeur |
|-------------|--------|
| **Email** | `admin@example.com` |
| **Mot de passe** | `admin123` |
| **Rôle** | `ADMIN` |
| **Modèle** | `Admin` |

> ⚠️ **Important** : Changez le mot de passe après la première connexion en production !

---

## 🎓 Comptes Candidat

### 🧪 Compte de Test (Développement)

| Information | Valeur |
|-------------|--------|
| **Email** | `candidat@example.com` |
| **Mot de passe** | `Candidat123!` |
| **Nom** | `Jean Koffi` |
| **Date de naissance** | `15/05/1995` |
| **Lieu de naissance** | `Cotonou, Bénin` |
| **Téléphone** | `+229 95 12 34 56` |
| **Rôle** | `USER` |
| **Modèle** | `User` |

### 📝 Inscription Publique

Les candidats peuvent s'inscrire via le formulaire public :

- **URL** : `/auth` (onglet "Inscription")
- **Champs requis** :
  - Email
  - Mot de passe (8+ caractères, majuscule, minuscule, chiffre, caractère spécial)
  - Nom complet (tel qu'apparaît sur l'acte de naissance)
  - Date de naissance (format JJ/MM/AAAA)
  - Lieu de naissance
  - Téléphone
- **Champs optionnels** :
  - Adresse postale

---

## 🛠️ Création des Comptes

### Via Script Seed (Recommandé)

```bash
# Exécuter le script de seed
pnpm seed
```

**Ce qui est créé :**
- ✅ 1 compte administrateur (`admin@fsa.bj`)
- ✅ 1 compte candidat de test (`candidat@example.com`)

### Via Interface Admin (Uniquement pour Admin)

Les administrateurs peuvent créer d'autres comptes admin depuis :
- **URL** : `/admin/users` (section "Gestion des utilisateurs")

### Via Formulaire Public (Uniquement pour Candidats)

Les candidats s'inscrivent automatiquement via :
- **URL** : `/auth`
- **Rôle attribué** : `USER` (automatique, non modifiable)

---

## 📂 Structure de la Base de Données

### Modèle `Admin`

```prisma
model Admin {
  id            String    @id @default(uuid())
  email         String    @unique
  password      String    // Hashé avec bcrypt
  name          String?
  role          String    @default("ADMIN")
  emailVerified DateTime?
  birthDate     DateTime?
  birthPlace    String?
  phone         String?
  address       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Modèle `User` (Candidat)

```prisma
model User {
  id            String    @id @default(uuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  password      String?   // Hashé avec bcrypt
  role          String    @default("USER")
  birthDate     DateTime?
  birthPlace    String?
  phone         String?
  address       String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
}
```

---

## 🔒 Sécurité des Mots de Passe

### Critères de Validation

| Critère | Admin | Candidat |
|---------|-------|----------|
| **Longueur minimale** | 8 caractères | 8 caractères |
| **Majuscule requise** | ❌ Non | ✅ Oui |
| **Minuscule requise** | ❌ Non | ✅ Oui |
| **Chiffre requis** | ❌ Non | ✅ Oui |
| **Caractère spécial** | ❌ Non | ✅ Oui |

### Hashage

- **Algorithme** : `bcrypt`
- **Sel** : 12 rounds
- **Stockage** : Hash uniquement (jamais en clair)

---

## 🚀 Commandes Utiles

```bash
# Générer le client Prisma
pnpm prisma generate

# Créer une migration
pnpm prisma migrate dev --name <nom>

# Exécuter le seed
pnpm seed

# Reset de la base de données (⚠️ efface toutes les données)
pnpm prisma migrate reset
```

---

## 📝 Notes Importantes

1. **Séparation des rôles** :
   - Les admins sont créés via `Admin` model
   - Les candidats sont créés via `User` model
   - Un candidat **ne peut pas** devenir admin via l'inscription publique

2. **Email unique** :
   - Chaque email doit être unique dans son modèle
   - Un même email peut exister dans `Admin` ET `User` (déconseillé)

3. **Protection des routes** :
   - `/admin/*` : Réservé aux utilisateurs avec rôle `ADMIN`
   - `/auth` : Public (connexion/inscription)
   - `/` : Public (accueil, vérification)

4. **Session** :
   - Durée par défaut : 7 jours
   - Option "Se souvenir de moi" : 30 jours
   - Déconnexion automatique à la fermeture du navigateur (si non coché)

---

## 📧 Support Technique

En cas de problème de connexion :

1. Vérifier que la base de données est accessible
2. Exécuter `pnpm prisma generate`
3. Vérifier les variables d'environnement (`.env`)
4. Consulter les logs : `console.error` dans les API routes

---

**Document mis à jour le** : 31 mars 2026  
**Version** : 1.0  
**Projet** : Attestation-FSA
