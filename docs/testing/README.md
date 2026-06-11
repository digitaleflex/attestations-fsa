# 🧪 Stratégie de Tests - Attestations FSA

**Dernière mise à jour** : 9 avril 2026  
**Public** : Développeurs  
**Stack** : Jest + Supertest + React Testing Library

---

## 📋 Vue d'Ensemble

### Objectifs
1. **Sécurité** : Vérifier que l'authentification et l'autorisation fonctionnent correctement
2. **Fiabilité** : S'assurer que les fonctionnalités core marchent sans régression
3. **Qualité** : Maintenir un code propre et testable
4. **Documentation** : Les tests servent de documentation vivante

### Couverture Actuelle vs Cible
| Métrique | Actuel | Cible |
|----------|--------|-------|
| **Tests écrits** | 2 fichiers | 50+ fichiers |
| **Couverture code** | ~15% | 80%+ |
| **Tests critiques** | Partiels | 100% |

---

## 📊 Inventaire des Tests Nécessaires

**Total : ~231 tests** répartis en 8 phases

### Phase 1 : Sécurité & Authentification (19 tests) 🔴
**Fichiers à créer :**
- `tests/lib/auth.test.ts` (10 tests)
- `tests/api/auth/auth.test.ts` (7 tests)
- `tests/api/auth/authorization.test.ts` (7 tests)

**Priorité** : CRITIQUE - Ces tests protègent contre les régressions de sécurité

### Phase 2 : Admin API Core (35 tests) 🔴
**Fichiers à créer :**
- `tests/api/admin/exams.test.ts` (12 tests)
- `tests/api/admin/attestations.test.ts` (13 tests)
- `tests/api/admin/users.test.ts` (12 tests)
- `tests/api/admin/submissions.test.ts` (5 tests)
- `tests/api/admin/bulk-actions.test.ts` (6 tests)

### Phase 3 : User API Core (25 tests) 🟡
**Fichiers à créer :**
- `tests/api/user/profile.test.ts` (9 tests)
- `tests/api/user/exams.test.ts` (5 tests)
- `tests/api/user/attestations.test.ts` (4 tests)
- `tests/api/user/results.test.ts` (4 tests)
- `tests/api/user/email-verification.test.ts` (7 tests)

### Phase 4 : Lib Utilities (34 tests) 🟡
**Fichiers à créer :**
- `tests/lib/rate-limit.test.ts` (6 tests)
- `tests/lib/sanitization.test.ts` (14 tests)
- `tests/lib/error-handler.test.ts` (7 tests)
- `tests/lib/anti-cheat.test.ts` (6 tests)
- `tests/lib/notifications.test.ts` (4 tests)
- `tests/lib/otp-store.test.ts` (4 tests)

### Phase 5 : Public API (25 tests) 🟡
**Fichiers à créer :**
- `tests/api/verifier.test.ts` (7 tests)
- `tests/api/signalement.test.ts` (6 tests - existe partiellement)
- `tests/api/public-contact.test.ts` (4 tests)
- `tests/api/public-waitlist.test.ts` (4 tests)
- `tests/api/public-stats.test.ts` (3 tests)
- Autres fichiers publics (4 tests)

### Phase 6 : E2E Flux Complets (17 tests) 🔴
**Fichiers à créer :**
- `tests/e2e/auth-flow.test.ts` (6 tests)
- `tests/e2e/exam-flow.test.ts` (5 tests)
- `tests/e2e/attestation-flow.test.ts` (4 tests)
- `tests/e2e/admin-dashboard.test.ts` (5 tests)

### Phase 7 : Admin Secondaire (40 tests) 🟢
**Fichiers à créer :**
- `tests/api/admin/settings.test.ts` (5 tests)
- `tests/api/admin/corrections.test.ts` (5 tests)
- `tests/api/admin/monitoring.test.ts` (3 tests)
- `tests/api/admin/audit.test.ts` (5 tests)
- `tests/api/admin/resources.test.ts` (3 tests)
- `tests/api/admin/notifications.test.ts` (2 tests)
- Autres fichiers admin (17 tests)

### Phase 8 : Composants UI (12 tests) 🟢
**Fichiers à créer :**
- `tests/components/admin/*.test.tsx` (5 tests)
- `tests/components/user/*.test.tsx` (4 tests)
- `tests/components/public/*.test.tsx` (5 tests)

---

## 🚀 Ordre d'Implémentation Recommandé

### Semaine 1 : Fondations (Phase 1 + 4)
1. **Tests Lib Utilities** (34 tests)
   - Car ce sont des tests unitaires purs (plus simples)
   - Pas besoin de mock complexe
   - Documentation existante dans ce dossier

2. **Tests Auth** (19 tests)
   - Base de toute sécurité
   - Nécessaire avant de tester les routes protégées

### Semaine 2 : API Core (Phase 2 + 3)
3. **Tests Admin API** (35 tests)
   - Fonctionnalités critiques
   - Couverture des routes sensibles

4. **Tests User API** (25 tests)
   - Flux utilisateur complet
   - Isolation des données

### Semaine 3 : Public & E2E (Phase 5 + 6)
5. **Tests Public API** (25 tests)
   - Endpoints publics
   - Rate limiting

6. **Tests E2E** (17 tests)
   - Flux complets
   - Intégration réelle

### Semaine 4 : Finitions (Phase 7 + 8)
7. **Tests Admin Secondaire** (40 tests)
8. **Tests Composants** (12 tests)

---

## 📁 Structure des Fichiers de Tests

```
tests/
├── lib/                          # Tests unitaires des utilitaires
│   ├── auth.test.ts
│   ├── rate-limit.test.ts
│   ├── sanitization.test.ts
│   ├── error-handler.test.ts
│   ├── anti-cheat.test.ts
│   ├── notifications.test.ts
│   ├── otp-store.test.ts
│   ├── email.test.ts
│   ├── csrf.test.ts
│   └── api-client.test.ts
├── api/                          # Tests d'intégration API
│   ├── auth/                     # Authentification
│   │   ├── auth.test.ts
│   │   ├── login-legacy.test.ts
│   │   └── authorization.test.ts
│   ├── admin/                    # Routes admin
│   │   ├── admin-profile.test.ts
│   │   ├── exams.test.ts
│   │   ├── attestations.test.ts
│   │   ├── bulk-actions.test.ts
│   │   ├── users.test.ts
│   │   ├── submissions.test.ts
│   │   ├── corrections.test.ts
│   │   ├── dashboard-stats.test.ts
│   │   ├── settings.test.ts
│   │   ├── audit.test.ts
│   │   ├── monitoring.test.ts
│   │   ├── resources.test.ts
│   │   ├── notifications.test.ts
│   │   ├── waitlist.test.ts
│   │   ├── internships.test.ts
│   │   ├── reclamations.test.ts
│   │   ├── otp-logs.test.ts
│   │   ├── contacts.test.ts
│   │   ├── portfolios.test.ts
│   │   └── transcript.test.ts
│   ├── user/                     # Routes utilisateur
│   │   ├── profile.test.ts
│   │   ├── exams.test.ts
│   │   ├── attestations.test.ts
│   │   ├── results.test.ts
│   │   ├── email-verification.test.ts
│   │   ├── transcript.test.ts
│   │   ├── statistics.test.ts
│   │   ├── notifications.test.ts
│   │   ├── portfolio.test.ts
│   │   ├── internships.test.ts
│   │   ├── reclamations.test.ts
│   │   ├── claim-code.test.ts
│   │   └── after-signup.test.ts
│   ├── public/                   # Routes publiques
│   │   ├── formations.test.ts
│   │   ├── exams.test.ts
│   │   ├── settings.test.ts
│   │   ├── portfolios.test.ts
│   │   ├── alumni.test.ts
│   │   └── internships.test.ts
│   ├── verifier.test.ts          # Vérification attestations
│   ├── signalement.test.ts       # Signalements (existe)
│   ├── resources.test.ts         # Ressources
│   ├── support.test.ts           # Support
│   └── chat.test.ts              # Chat
├── e2e/                          # Tests end-to-end
│   ├── auth-flow.test.ts
│   ├── exam-flow.test.ts
│   ├── attestation-flow.test.ts
│   └── admin-dashboard.test.ts
├── components/                   # Tests de composants React
│   ├── admin/
│   │   ├── dashboard.test.tsx
│   │   ├── exam-form.test.tsx
│   │   ├── user-list.test.tsx
│   │   ├── settings.test.tsx
│   │   └── monitoring.test.tsx
│   ├── user/
│   │   ├── dashboard.test.tsx
│   │   ├── exam-page.test.tsx
│   │   ├── profile.test.tsx
│   │   └── results.test.tsx
│   └── public/
│       ├── landing.test.tsx
│       ├── login-form.test.tsx
│       ├── registration-form.test.tsx
│       ├── verification.test.tsx
│       └── signalement-form.test.tsx
└── helpers/                      # Utilitaires de tests
    ├── auth.ts                   # Helpers d'authentification
    ├── db.ts                     # Helpers base de données
    ├── mocks.ts                  # Mocks communs
    └── fixtures.ts               # Données de test
```

---

## 🛠️ Configuration des Tests

### Jest Config (`jest.config.js`)
Déjà configuré dans le projet. Vérifier :
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/', '<rootDir>/lib/'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Setup Tests (`tests/setup.ts`)
```typescript
// Nettoyer la DB avant chaque test
import { prisma } from '@/lib/prisma';

beforeEach(async () => {
  // Supprimer les données de test
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.securityLog.deleteMany(),
    prisma.examSession.deleteMany(),
    prisma.attestation.deleteMany(),
    prisma.exam.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

---

## 📝 Conventions de Nommage

### Fichiers de Tests
- **Format** : `nom-du-module.test.ts`
- **Exemples** :
  - `auth.test.ts`
  - `admin-profile.test.ts`
  - `exam-flow.test.ts`

### Tests Individuels
- **Format** : `describe('Module', () => { it('devrait faire X quand Y', ...) })`
- **Langue** : Français pour la lisibilité de l'équipe
- **Exemples** :
  ```typescript
  describe('getAdminUser', () => {
    it('devrait retourner l\'admin quand la session Better Auth est valide', async () => {
      // ...
    });
    
    it('devrait retourner null quand l\'utilisateur n\'est pas admin', async () => {
      // ...
    });
  });
  ```

---

## 🎯 Métriques de Suivi

### Tableau de Progression

| Phase | Fichiers | Tests Écrits | Total | % |
|-------|----------|--------------|-------|---|
| **1. Sécurité/Auth** | 0/3 | 0 | 19 | 0% |
| **2. Admin Core** | 0/5 | 0 | 35 | 0% |
| **3. User Core** | 0/5 | 0 | 25 | 0% |
| **4. Lib Utilities** | 0/6 | 0 | 34 | 0% |
| **5. Public API** | 0/6 | 0 | 25 | 0% |
| **6. E2E** | 0/4 | 0 | 17 | 0% |
| **7. Admin Secondaire** | 0/8 | 0 | 40 | 0% |
| **8. Composants** | 0/3 | 0 | 12 | 0% |
| **TOTAL** | **0/40** | **0** | **~231** | **0%** |

### À Mettre à Jour Après Chaque Session de Tests

---

## 📚 Documentation Associée

- [Guide : Écriture Tests Unitaires](./guide-tests-unitaires.md)
- [Guide : Écriture Tests Intégration API](./guide-tests-integration-api.md)
- [Guide : Écriture Tests E2E](./guide-tests-e2e.md)
- [Guide : Mocks & Fixtures](./guide-mocks-fixtures.md)
- [Exemple : Test Auth Complet](../tests/lib/auth.test.ts) (à créer)
- [Exemple : Test API Admin](../tests/api/admin/exams.test.ts) (à créer)

---

**Prochaine Étape** : Commencer par la **Phase 4 (Lib Utilities)** car ce sont les tests les plus simples à écrire.
