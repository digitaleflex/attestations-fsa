# 🔧 Guide : Mocks & Fixtures pour les Tests

**Public** : Développeurs  
**Difficulté** : Intermédiaire  
**Temps estimé** : 1-2h de lecture + pratique

---

## 📋 Qu'est-ce qu'un Mock et une Fixture ?

### Mock
Un **mock** simule le comportement d'une dépendance externe (DB, API, service email) pour isoler le test.

### Fixture
Une **fixture** est une donnée de test pré-configurée et réutilisable.

---

## 🗂️ Structure des Helpers de Test

```
tests/
├── helpers/
│   ├── auth.ts              # Helpers d'authentification
│   ├── db.ts                # Helpers base de données
│   ├── fixtures.ts          # Données de test réutilisables
│   └── mocks.ts             # Mocks communs
└── setup.ts                 # Configuration globale des tests
```

---

## 🔐 Helper d'Authentification

### Fichier : `tests/helpers/auth.ts`

```typescript
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Crée un utilisateur admin pour les tests
 * @returns L'utilisateur créé + cookie de session
 */
export async function createAdminUser() {
  const user = await prisma.user.create({
    data: {
      email: `admin-${Date.now()}@test.com`,
      name: 'Admin Test',
      password: await bcrypt.hash('password123', 10),
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });

  const sessionCookie = await createSessionCookie(user.id);
  
  return { user, sessionCookie };
}

/**
 * Crée un utilisateur régulier pour les tests
 * @returns L'utilisateur créé + cookie de session
 */
export async function createRegularUser() {
  const user = await prisma.user.create({
    data: {
      email: `user-${Date.now()}@test.com`,
      name: 'User Test',
      password: await bcrypt.hash('password123', 10),
      role: 'USER',
      emailVerified: new Date(),
    },
  });

  const sessionCookie = await createSessionCookie(user.id);
  
  return { user, sessionCookie };
}

/**
 * Crée un cookie de session simulé pour les tests
 * Note: Adapter selon votre implémentation d'auth réelle
 */
async function createSessionCookie(userId: string): Promise<string> {
  // Option 1: Utiliser l'API Better Auth pour créer une vraie session
  // Option 2: Simuler un cookie pour les tests
  
  // Exemple avec Better Auth (si disponible en test)
  // const session = await auth.api.createSession({ userId });
  // return `better-auth.session=${session.token}`;
  
  // Pour l'instant, retourner un mock
  return `session=${userId}`;
}

/**
 * Vérifie si un utilisateur existe
 */
export async function userExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return !!user;
}

/**
 * Supprime un utilisateur et ses données associées
 */
export async function deleteUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    await prisma.$transaction([
      prisma.examSession.deleteMany({ where: { userId: user.id } }),
      prisma.attestation.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);
  }
}
