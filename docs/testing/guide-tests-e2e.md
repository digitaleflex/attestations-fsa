# 🧪 Guide : Écriture de Tests E2E (End-to-End)

**Public** : Développeurs  
**Difficulté** : Avancé  
**Temps estimé** : 4-6h par fichier

---

## 🚀 Prérequis & exécution (la suite réelle)

> ⚠️ La suite réelle du projet est **Playwright**, dans `e2e/*.e2e.ts` avec la
> configuration `playwright.config.ts`. Tout le reste de ce document est un
> guide d'écriture générique, pas la procédure d'exécution.

### 1. Prérequis

- Docker Desktop en marche (daemon actif)
- Node 22 + pnpm 9.15.4
- Navigateur Playwright : `npx playwright install chromium`

### 2. Base de données E2E (séparée de la dev)

| | Dev | **E2E** |
| --- | --- | --- |
| Port hôte | `5432` | **`5434`** |
| Base | `attestation_fsa` | **`attestation_fsa_e2e`** |
| Service compose | `postgres` | **`postgres-e2e`** |

`e2e/setup/env.ts` **refuse** le port 5432 / la base `attestation_fsa` :
la suite ne peut jamais écraser la base de développement. L'URL est dérivée
automatiquement depuis `.env.local` (seuls port et base sont remplacés) ; en CI,
on la force avec `E2E_DATABASE_URL` (prioritaire).

### 3. Lancer la suite (2 commandes)

```bash
pnpm e2e:setup      # démarre postgres-e2e (5434) + migrate + seed
pnpm test:e2e       # exécute les 2 projets Playwright
```

Optionnel : `pnpm e2e:db:down` (arrête la base E2E sans la détruire).

Si vos crédits `.env.local` diffèrent des valeurs par défaut de compose,
définissez explicitement :

```bash
export E2E_DATABASE_URL="postgresql://USER:PASS@localhost:5434/attestation_fsa_e2e"
pnpm test:e2e
```

### 4. Les deux projets Playwright

| Projet | Contenu | Exécution |
| --- | --- | --- |
| `chromium` | `parcours-candidat.e2e.ts` (auth → examen → score → attestation → PDF → vérification publique) + `verification-publique.e2e.ts` | normal |
| `chromium-ui-examen` | `ui-examen.e2e.ts` : même parcours **100 % via l'interface** | projet dédié, lancé en dernier |

`workers: 1` : les tests partagent l'état applicatif (session, attestation émise).
Le serveur est un `next dev` sur le **port 3100** (`distDir` `.next-e2e`, rate-limit
mémoire), démarré par Playwright — ne jamais le lancer soi-même sur ce port.

### 5. Deux façons de semer (ne pas confondre)

| Commande | Base visée | Prérequis |
| --- | --- | --- |
| `pnpm db:seed` | base **dev** (`5432`, via `.env.local`) | `docker compose -f compose.local.yml up -d postgres` |
| `pnpm e2e:seed` | base **E2E** (`5434`) | `pnpm e2e:db:up` |

> Historique : `pnpm db:seed` échouait sur Windows avec
> `TS5023: Unknown compiler option '0'…'3'` — `prisma db seed` passait le JSON
> `--compiler-options` par le shell, qui le déformait. Le seed s'appelle
> désormais sur `tsconfig.seed.json` (valeur d'option non transmise en CLI).

### 6. CI

`test.yml` fournit le service `postgres:17-alpine` (5434) et injecte
`E2E_DATABASE_URL` ; voir le job `e2e`.

---

Un test E2E (End-to-End) vérifie un **flux utilisateur complet** du début à la fin, en simulant un vrai utilisateur qui utilise l'application.

### Différence avec les Tests d'Intégration

| Type | Portée | Exemple |
|------|--------|---------|
| **Unitaire** | Une fonction | `sanitizeInput()` supprime le HTML |
| **Intégration** | Une API route | `POST /api/admin/exams` crée un examen |
| **E2E** | Flux complet | Inscription → Login → Passage d'examen → Résultats |

---

## 🛠️ Outils Nécessaires

### Playwright (Recommandé) ou Cypress

```bash
pnpm add -D @playwright/test
npx playwright install
```

### Alternative : Tests E2E avec Supertest

Pour les API, on peut utiliser Supertest pour simuler des flux complets sans navigateur.

---

## 📝 Exemple Complet : Flux d'Authentification

### Fichier : `tests/e2e/auth-flow.test.ts`

```typescript
/**
 * Tests E2E du flux d'authentification complet
 * @module tests/e2e/auth-flow.test.ts
 * @description Vérifie le parcours : Inscription → Vérification Email → Login → Dashboard
 */

import request from 'supertest';
import { prisma } from '@/lib/prisma';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('E2E: Flux d\'Authentification Complet', () => {
  
  // Nettoyage avant chaque test
  beforeEach(async () => {
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.examSession.deleteMany(),
      prisma.attestation.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Scénario 1: Inscription complète avec vérification email', () => {
    it('devrait permettre à un utilisateur de s\'inscrire, vérifier son email, et accéder au dashboard', async () => {
      // === ÉTAPE 1: INSCRIPTION ===
      console.log('📝 Étape 1: Inscription...');
      
      const signupResponse = await request(BASE_URL)
        .post('/api/auth/register')
        .send({
          email: 'nouveau-user@example.com',
          password: 'MonMotDePasse123!',
          name: 'Nouveau User',
        });

      expect([200, 201, 302]).toContain(signupResponse.status);
      
      // Vérifier que l'utilisateur est en base
      const userInDb = await prisma.user.findUnique({
        where: { email: 'nouveau-user@example.com' },
      });
      
      expect(userInDb).not.toBeNull();
      expect(userInDb?.emailVerified).toBeFalsy(); // Pas encore vérifié
      console.log('✅ Utilisateur créé en base');

      // === ÉTAPE 2: VÉRIFICATION EMAIL ===
      console.log('📧 Étape 2: Vérification email...');
      
      // Récupérer le token OTP (en test, on peut le lire en DB)
      // En production, il faudrait intercepter l'email ou utiliser un service de test
      const emailToken = await prisma.emailVerificationToken.findFirst({
        where: { email: 'nouveau-user@example.com' },
        orderBy: { createdAt: 'desc' },
      });

      if (emailToken) {
        const verifyResponse = await request(BASE_URL)
          .get(`/api/user/verify-email?token=${emailToken.token}`)
          .expect(302); // Redirect après vérification

        // Vérifier que l'email est maintenant vérifié
        const updatedUser = await prisma.user.findUnique({
          where: { email: 'nouveau-user@example.com' },
        });

        expect(updatedUser?.emailVerified).toBeTruthy();
        console.log('✅ Email vérifié');
      }

      // === ÉTAPE 3: CONNEXION ===
      console.log('🔐 Étape 3: Connexion...');
      
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({
          email: 'nouveau-user@example.com',
          password: 'MonMotDePasse123!',
        });

      expect([200, 302]).toContain(loginResponse.status);
      
      // Extraire le cookie de session
      const sessionCookie = loginResponse.headers['set-cookie']?.find((c: string) =>
        c.includes('session') || c.includes('better-auth')
      );

      expect(sessionCookie).toBeDefined();
      console.log('✅ Connecté avec session');

      // === ÉTAPE 4: ACCÈS AU DASHBOARD ===
      console.log('📊 Étape 4: Accès au dashboard...');
      
      const dashboardResponse = await request(BASE_URL)
        .get('/api/user/profile')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(dashboardResponse.body).toHaveProperty('id');
      expect(dashboardResponse.body.email).toBe('nouveau-user@example.com');
      expect(dashboardResponse.body.name).toBe('Nouveau User');
      console.log('✅ Dashboard accessible');

      console.log('🎉 Flux d\'authentification complet réussi !');
    });
  });

  describe('Scénario 2: Connexion avec 2FA', () => {
    it('devrait demander la vérification 2FA si activée', async () => {
      // Créer un admin avec 2FA activée
      const admin = await createAdminWith2FA();

      // ÉTAPE 1: Login normal
      const loginResponse = await request(BASE_URL)
        .post('/api/auth/login')
        .send({
          email: admin.email,
          password: 'password123',
        });

      // Devrait indiquer qu'une 2FA est requise
      expect(loginResponse.body).toHaveProperty('twoFactorRedirect', true);
      console.log('✅ 2FA requise après login');

      // ÉTAPE 2: Vérification TOTP
      const totpCode = generateTOTPCode(admin.totpSecret);
      
      const verifyResponse = await request(BASE_URL)
        .post('/api/auth/verify-totp')
        .send({
          code: totpCode,
          temporaryToken: loginResponse.body.temporaryToken,
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.headers['set-cookie']).toBeDefined();
      console.log('✅ 2FA vérifiée avec succès');
    });
  });

  describe('Scénario 3: Récupération de mot de passe', () => {
    it('devrait permettre de réinitialiser le mot de passe via OTP email', async () => {
      // Créer un utilisateur
      const user = await prisma.user.create({
        data: {
          email: 'user-reset@example.com',
          name: 'User Reset',
          password: 'old-password',
          role: 'USER',
          emailVerified: new Date(),
        },
      });

      // ÉTAPE 1: Demande de reset
      const forgotResponse = await request(BASE_URL)
        .post('/api/auth/forgot-password')
        .send({ email: 'user-reset@example.com' })
        .expect(200);

      console.log('📧 Demande de reset envoyée');

      // ÉTAPE 2: Récupérer l'OTP (en test)
      const otpRecord = await prisma.passwordResetToken.findFirst({
        where: { email: 'user-reset@example.com' },
        orderBy: { createdAt: 'desc' },
      });

      if (otpRecord) {
        // ÉTAPE 3: Reset avec OTP
        const resetResponse = await request(BASE_URL)
          .post('/api/auth/reset-password')
          .send({
            otp: otpRecord.token,
            newPassword: 'new-secure-password123',
          })
          .expect(200);

        console.log('🔑 Mot de passe réinitialisé');

        // ÉTAPE 4: Login avec nouveau mot de passe
        const loginResponse = await request(BASE_URL)
          .post('/api/auth/login')
          .send({
            email: 'user-reset@example.com',
            password: 'new-secure-password123',
          })
          .expect(200);

        expect(loginResponse.headers['set-cookie']).toBeDefined();
        console.log('✅ Connexion avec nouveau mot de passe réussie');
      }
    });
  });

  describe('Scénario 4: Session expiration et re-login', () => {
    it('devrait rediriger vers login quand la session expire', async () => {
      // Créer un utilisateur avec session
      const user = await prisma.user.create({
        data: {
          email: 'user-session@example.com',
          name: 'User Session',
          password: 'password123',
          role: 'USER',
          emailVerified: new Date(),
        },
      });

      // Simuler une session expirée (date dans le passé)
      const expiredSession = await prisma.session.create({
        data: {
          userId: user.id,
          token: 'expired-session-token',
          expiresAt: new Date(Date.now() - 1000), // Expirée il y a 1s
        },
      });

      // Essayer d'accéder à une route protégée
      const response = await request(BASE_URL)
        .get('/api/user/profile')
        .set('Cookie', `session=${expiredSession.token}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      console.log('✅ Session expirée correctement rejetée');
    });
  });
});

// === HELPERS ===

async function createAdminWith2FA() {
  const totpSecret = 'JBSWY3DPEHPK3PXP'; // Secret de test
  
  const admin = await prisma.user.create({
    data: {
      email: `admin-2fa-${Date.now()}@test.com`,
      name: 'Admin 2FA',
      password: 'password123',
      role: 'ADMIN',
      emailVerified: new Date(),
      twoFactorEnabled: true,
      twoFactorSecret: totpSecret, // Stocké chiffré en production
    },
  });

  return {
    ...admin,
    totpSecret,
  };
}

function generateTOTPCode(secret: string): string {
  // En production, utiliser une vraie librairie OTP
  // Pour les tests, retourner un code mock
  return '123456';
}
