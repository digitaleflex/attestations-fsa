# 🧪 Guide : Écriture de Tests d'Intégration API

**Public** : Développeurs  
**Difficulté** : Intermédiaire  
**Temps estimé** : 3-4h par fichier

---

## 📋 Qu'est-ce qu'un Test d'Intégration API ?

Un test d'intégration vérifie que **plusieurs composants** fonctionnent ensemble correctement. Pour les API routes, cela inclut :
- La route API elle-même
- L'authentification/autorisation
- Les appels à la base de données
- La validation des données
- Les réponses HTTP

---

## 🛠️ Outils Nécessaires

### Supertest
Bibliothèque pour tester les endpoints HTTP.

```bash
pnpm add -D supertest @types/supertest
```

### Utilitaires d'Authentification
Créer des helpers pour simuler des sessions admin/user.

---

## 📝 Structure d'un Test API

### Pattern Complet

```typescript
describe('GET /api/admin/exams', () => {
  it('devrait retourner la liste des examens pour un admin authentifié', async () => {
    // 1. ARRANGE : Préparer l'environnement
    const admin = await createAdminUser();
    const exam = await createExam({ title: 'Examen Test' });
    
    // 2. ACT : Faire la requête
    const response = await request(app)
      .get('/api/admin/exams')
      .set('Cookie', admin.sessionCookie)
      .expect(200);
    
    // 3. ASSERT : Vérifier la réponse
    expect(response.body).toHaveProperty('exams');
    expect(response.body.exams).toHaveLength(1);
    expect(response.body.exams[0].title).toBe('Examen Test');
  });
});
```

---

## 🔐 Helpers d'Authentification

### Fichier : `tests/helpers/auth.ts`

```typescript
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

  // Simuler une session (adapter selon votre méthode d'auth)
  const sessionCookie = await createSessionCookie(user.id);
  
  return { user, sessionCookie };
}

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

async function createSessionCookie(userId: string): Promise<string> {
  // Créer un cookie de session valide pour les tests
  // Cette fonction dépend de votre implémentation d'auth
  // Retourner un cookie simulé ou utiliser Better Auth API
  return `session=${userId}`;
}
```

---

## 📊 Exemple Complet : Test API Admin Exams

### Fichier : `tests/api/admin/exams.test.ts`

```typescript
/**
 * Tests pour les routes API admin d'examens
 * @module tests/api/admin/exams.test.ts
 */

import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { createAdminUser, createRegularUser } from '@/tests/helpers/auth';

// URL de base pour les tests (adapter selon config)
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Admin Exams API', () => {
  let admin: any;
  let user: any;

  // Setup : Créer les utilisateurs de test
  beforeAll(async () => {
    admin = await createAdminUser();
    user = await createRegularUser();
  });

  // Cleanup : Nettoyer après tous les tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Reset : Nettoyer entre chaque test
  beforeEach(async () => {
    await prisma.examSession.deleteMany();
    await prisma.exam.deleteMany();
    await prisma.formation.deleteMany();
  });

  describe('GET /api/admin/exams', () => {
    it('devrait retourner 401 sans authentification', async () => {
      const response = await request(BASE_URL)
        .get('/api/admin/exams')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });

    it('devrait retourner 401 pour un utilisateur non-admin', async () => {
      const response = await request(BASE_URL)
        .get('/api/admin/exams')
        .set('Cookie', user.sessionCookie)
        .expect(401);
    });

    it('devrait retourner la liste des examens pour un admin', async () => {
      // Créer des données de test
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });
      
      const exam1 = await prisma.exam.create({
        data: {
          title: 'Examen 1',
          formationId: formation.id,
          type: 'OFFICIAL',
        },
      });
      
      const exam2 = await prisma.exam.create({
        data: {
          title: 'Examen 2',
          formationId: formation.id,
          type: 'MOCK',
        },
      });

      const response = await request(BASE_URL)
        .get('/api/admin/exams')
        .set('Cookie', admin.sessionCookie)
        .expect(200);

      expect(response.body).toHaveProperty('exams');
      expect(response.body.exams).toHaveLength(2);
      expect(response.body.exams[0]).toHaveProperty('id');
      expect(response.body.exams[0]).toHaveProperty('title');
    });

    it('devrait supporter le filtrage par type', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });
      
      await prisma.exam.create({
        data: { title: 'Examen Official', formationId: formation.id, type: 'OFFICIAL' },
      });
      
      await prisma.exam.create({
        data: { title: 'Examen Mock', formationId: formation.id, type: 'MOCK' },
      });

      const response = await request(BASE_URL)
        .get('/api/admin/exams?type=OFFICIAL')
        .set('Cookie', admin.sessionCookie)
        .expect(200);

      expect(response.body.exams).toHaveLength(1);
      expect(response.body.exams[0].type).toBe('OFFICIAL');
    });
  });

  describe('POST /api/admin/exams', () => {
    it('devrait créer un examen avec des données valides', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const examData = {
        title: 'Nouvel Examen',
        formationId: formation.id,
        type: 'OFFICIAL',
        duration: 60,
        passingScore: 70,
        parts: [
          {
            title: 'Partie 1',
            type: 'QCM',
            duration: 30,
            points: 20,
            order: 1,
            questions: [
              {
                text: 'Question 1',
                type: 'QCM',
                points: 5,
                order: 1,
                options: [
                  { text: 'Réponse A', isCorrect: true, feedback: '' },
                  { text: 'Réponse B', isCorrect: false, feedback: '' },
                ],
              },
            ],
          },
        ],
      };

      const response = await request(BASE_URL)
        .post('/api/admin/exams')
        .set('Cookie', admin.sessionCookie)
        .send(examData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Nouvel Examen');
      expect(response.body.parts).toHaveLength(1);
      
      // Vérifier que l'examen est en base
      const examInDb = await prisma.exam.findUnique({
        where: { id: response.body.id },
        include: { parts: true },
      });
      
      expect(examInDb).not.toBeNull();
      expect(examInDb?.parts).toHaveLength(1);
    });

    it('devrait rejeter un examen sans titre', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const response = await request(BASE_URL)
        .post('/api/admin/exams')
        .set('Cookie', admin.sessionCookie)
        .send({ formationId: formation.id })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('devrait créer un log d\'audit', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const beforeCount = await prisma.auditLog.count();

      await request(BASE_URL)
        .post('/api/admin/exams')
        .set('Cookie', admin.sessionCookie)
        .send({
          title: 'Examen Test',
          formationId: formation.id,
          type: 'OFFICIAL',
        })
        .expect(201);

      const afterCount = await prisma.auditLog.count();
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('devrait appliquer le rate limiting', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const examData = {
        title: 'Examen',
        formationId: formation.id,
        type: 'OFFICIAL',
      };

      // Faire 10 requêtes rapides
      for (let i = 0; i < 10; i++) {
        await request(BASE_URL)
          .post('/api/admin/exams')
          .set('Cookie', admin.sessionCookie)
          .send(examData);
      }

      // La 11ème devrait être limitée
      const response = await request(BASE_URL)
        .post('/api/admin/exams')
        .set('Cookie', admin.sessionCookie)
        .send(examData);

      // Soit 429 (rate limited) soit toujours 201 si Redis non configuré
      expect([201, 429]).toContain(response.status);
    });
  });

  describe('PATCH /api/admin/exams/[id]', () => {
    it('devrait mettre à jour un examen existant', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const exam = await prisma.exam.create({
        data: {
          title: 'Ancien Titre',
          formationId: formation.id,
          type: 'OFFICIAL',
        },
      });

      const response = await request(BASE_URL)
        .patch(`/api/admin/exams/${exam.id}`)
        .set('Cookie', admin.sessionCookie)
        .send({ title: 'Nouveau Titre' })
        .expect(200);

      expect(response.body.title).toBe('Nouveau Titre');
      
      const examInDb = await prisma.exam.findUnique({
        where: { id: exam.id },
      });
      
      expect(examInDb?.title).toBe('Nouveau Titre');
    });

    it('devrait retourner 404 pour un examen inexistant', async () => {
      const response = await request(BASE_URL)
        .patch('/api/admin/exams/exam-id-inexistant')
        .set('Cookie', admin.sessionCookie)
        .send({ title: 'Test' })
        .expect(404);
    });
  });

  describe('DELETE /api/admin/exams/[id]', () => {
    it('devrait supprimer un examen', async () => {
      const formation = await prisma.formation.create({
        data: { name: 'Formation Test', category: 'TEST' },
      });

      const exam = await prisma.exam.create({
        data: {
          title: 'Examen à Supprimer',
          formationId: formation.id,
          type: 'OFFICIAL',
        },
      });

      await request(BASE_URL)
        .delete(`/api/admin/exams/${exam.id}`)
        .set('Cookie', admin.sessionCookie)
        .expect(200);

      const examInDb = await prisma.exam.findUnique({
        where: { id: exam.id },
      });
      
      expect(examInDb).toBeNull();
    });
  });
});
```

---

## 🔧 Techniques Avancées

### 1. Tester les Codes de Statut HTTP

```typescript
it('devrait retourner les bons codes de statut', async () => {
  // 400 - Bad Request
  await request(BASE_URL)
    .post('/api/admin/exams')
    .set('Cookie', admin.sessionCookie)
    .send({})
    .expect(400);
  
  // 401 - Unauthorized
  await request(BASE_URL)
    .get('/api/admin/exams')
    .expect(401);
  
  // 403 - Forbidden
  await request(BASE_URL)
    .get('/api/admin/exams')
    .set('Cookie', user.sessionCookie)
    .expect(401); // ou 403 selon implémentation
  
  // 404 - Not Found
  await request(BASE_URL)
    .get('/api/admin/exams/inexistant')
    .set('Cookie', admin.sessionCookie)
    .expect(404);
  
  // 200/201 - Success
  await request(BASE_URL)
    .get('/api/admin/exams')
    .set('Cookie', admin.sessionCookie)
    .expect(200);
});
```

### 2. Tester la Validation des Données

```typescript
it('devrait valider le format d\'email', async () => {
  const response = await request(BASE_URL)
    .post('/api/users')
    .set('Cookie', admin.sessionCookie)
    .send({
      name: 'Test User',
      email: 'email-invalide',
      password: 'password123',
    })
    .expect(400);

  expect(response.body.error).toContain('email');
});

it('devrait valider la longueur du mot de passe', async () => {
  const response = await request(BASE_URL)
    .post('/api/users')
    .set('Cookie', admin.sessionCookie)
    .send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'court',
    })
    .expect(400);

  expect(response.body.error).toContain('8 caractères');
});
```

### 3. Tester l'Isolation des Données

```typescript
it('devrait isoler les données entre utilisateurs', async () => {
  const user1 = await createRegularUser();
  const user2 = await createRegularUser();

  // User 1 crée une attestation
  await prisma.attestation.create({
    data: {
      userId: user1.user.id,
      code: 'FSA-2026-M04-00001-abc12',
      fullName: 'User 1 Attestation',
    },
  });

  // User 2 ne devrait pas voir l'attestation de User 1
  const response = await request(BASE_URL)
    .get('/api/user/attestations')
    .set('Cookie', user2.sessionCookie)
    .expect(200);

  expect(response.body.attestations).toHaveLength(0);
});
```

### 4. Tester le Rate Limiting

```typescript
it('devrait limiter après 5 tentatives de login', async () => {
  const loginData = {
    email: 'admin@test.com',
    password: 'wrong-password',
  };

  // 5 tentatives
  for (let i = 0; i < 5; i++) {
    await request(BASE_URL)
      .post('/api/auth/login')
      .send(loginData);
  }

  // 6ème tentative devrait être bloquée
  const response = await request(BASE_URL)
    .post('/api/auth/login')
    .send(loginData);

  expect([429, 401]).toContain(response.status);
  
  if (response.status === 429) {
    expect(response.body).toHaveProperty('retryAfter');
  }
});
```

---

## ✅ Checklist avant de Commiter

- [ ] Tous les scénarios testés (succès, erreurs, cas limites)
- [ ] Authentification testée (401, 403)
- [ ] Validation des données testée (400)
- [ ] Isolation des données vérifiée
- [ ] Rate limiting testé si applicable
- [ ] Audit logs vérifiés si applicable
- [ ] Nettoyage DB après tests
- [ ] Tests indépendants et reproductibles

---

## 🚀 Commandes Utiles

```bash
# Lancer un fichier de test API spécifique
npm test -- tests/api/admin/exams.test.ts

# Lancer avec logs détaillés
npm test -- tests/api/admin/exams.test.ts --verbose

# Lancer tous les tests admin
npm test -- tests/api/admin/

# Voir la couverture de code
npm test -- --coverage tests/api/admin/
```

---

## 📊 Template de Fichier de Test API

```typescript
/**
 * Tests pour [nom de la route API]
 * @module tests/api/[chemin]/[nom].test.ts
 */

import request from 'supertest';
import { prisma } from '@/lib/prisma';
import { createAdminUser, createRegularUser } from '@/tests/helpers/auth';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('[Méthode] [Route]', () => {
  let admin: any;
  let user: any;

  beforeAll(async () => {
    admin = await createAdminUser();
    user = await createRegularUser();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Nettoyer les données de test
  });

  describe('GET [route]', () => {
    it('devrait retourner 401 sans auth', async () => {
      // ...
    });

    it('devrait retourner les données avec auth', async () => {
      // ...
    });
  });

  describe('POST [route]', () => {
    it('devrait créer avec des données valides', async () => {
      // ...
    });

    it('devrait rejeter avec des données invalides', async () => {
      // ...
    });
  });

  describe('PATCH [route]/[id]', () => {
    it('devrait mettre à jour', async () => {
      // ...
    });
  });

  describe('DELETE [route]/[id]', () => {
    it('devrait supprimer', async () => {
      // ...
    });
  });
});
```

---

**Guide Précédent** : [Tests Unitaires](./guide-tests-unitaires.md)  
**Prochain Guide** : [Tests E2E](./guide-tests-e2e.md)
