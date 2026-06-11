# 🔐 Comptes et Authentification - FSA

## 📋 Vue d'ensemble

Le système d'authentification de la **Ferme St André (FSA)** est basé sur **Better Auth**. Tous les types d'utilisateurs (Candidats et Administrateurs) sont centralisés dans une table unique `User` en base de données, gérée via un système de rôles.

| Rôle | Description | Accès |
|------|-------------|-------|
| `admin` | Administrateur de la plateforme | Accès complet au Backoffice, gestion des utilisateurs, examens et attestations |
| `user` | Candidat / Apprenant | Espace candidat (Dashboard personnel, examens, téléchargement d'attestations) |

---

## 👤 Comptes Administrateur

### 🔑 Configuration de Production
- **Email** : Configuré par l'administrateur système lors du déploiement.
- **Rôle** : `admin` (défini dans la colonne `role` du modèle `User`).
- **URL de connexion** : `/admin/login`

### 🔒 Sécurité Administrateur : Double Facteur (2FA)
Pour protéger l'accès au backoffice, une authentification à deux facteurs (2FA) est disponible et hautement recommandée pour les administrateurs :
- **TOTP** : Application d'authentification (Google Authenticator, Authy, etc.).
- **OTP par Email** : Envoi d'un code temporaire par email (validité 5 minutes, 5 essais max).
- **Codes de secours** : 10 codes à usage unique générés à l'activation pour parer à la perte de l'appareil 2FA.
- **Appareil de confiance** : Possibilité de mémoriser l'appareil pendant 30 jours.

*Note : La 2FA est désactivée par défaut et peut être activée volontairement depuis l'espace admin.*

---

## 🎓 Comptes Candidat

### 📝 Inscription Publique
Les candidats s'inscrivent via le formulaire public :
- **URL** : `/auth` (onglet "Inscription")
- **Champs requis** :
  - Nom complet (doit correspondre à l'acte de naissance pour les futures attestations)
  - Email (validation par OTP obligatoire lors de la création du compte)
  - Mot de passe (8+ caractères, géré de façon sécurisée par Better Auth)
  - Date de naissance (format FR `JJ/MM/AAAA` géré et converti côté serveur)
  - Lieu de naissance
  - Téléphone
- **Rôle attribué** : `user` (défini automatiquement, non modifiable par l'utilisateur).

---

## 📂 Structure de la Base de Données

Le modèle Prisma unique pour l'authentification est le suivant :

```prisma
model User {
  id                    String              @id @default(uuid())
  name                  String?
  email                 String?             @unique
  emailVerified         DateTime?
  password              String?             // Hashé avec Better Auth (bcrypt 12 rounds)
  role                  String              @default("user")
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
  
  // Champs spécifiques FSA
  phone                 String?
  birthDate             DateTime?
  birthPlace            String?
  address               String?
  attestationCode       String?             @unique
  attestationStatus     String              @default("PENDING")
  
  // Relations Better Auth & FSA
  accounts              Account[]
  sessions              Session[]
  attestations          Attestation[]
  examSessions          ExamSession[]
  // ...
}
```

*Le modèle historique `Admin` a été supprimé afin de simplifier la gestion des sessions et d'unifier l'infrastructure d'authentification.*

---

## 🛠️ Commandes Utiles de Base de Données

```bash
# Générer le client Prisma
npm run db:generate

# Lancer les migrations en local
npm run db:migrate

# Déployer les migrations en production
npm run db:deploy

# Lancer le script de peuplement (seed)
npm run db:seed
```

---

## 🔒 Sécurité des Mots de Passe & Sessions

- **Hashage** : Les mots de passe sont hashés à l'aide de l'algorithme `bcrypt` (12 rounds) via Better Auth.
- **Cookies** : Les jetons de session sont stockés dans des cookies sécurisés `httpOnly`, avec le flag `SameSite` configuré sur `Lax` ou `Strict`.
- **Expiration** : Les sessions candidats et admins expirent après 30 jours (renouvellement de la validité de session toutes les 24 heures en cas d'activité).

**Dernière mise à jour** : Juin 2026  
**Technologie** : Better Auth integration  
