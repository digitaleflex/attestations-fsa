# 🧪 Guide : Écriture de Tests Unitaires

**Public** : Développeurs  
**Difficulté** : Débutant  
**Temps estimé** : 2-3h par fichier

---

## 📋 Qu'est-ce qu'un Test Unitaire ?

Un test unitaire vérifie le comportement d'**une seule fonction** de manière isolée.

### Caractéristiques
- ✅ Rapide (< 100ms par test)
- ✅ Isolé (pas de DB, pas de réseau)
- ✅ Déterministe (toujours le même résultat)
- ✅ Autonome (mock des dépendances externes)

---

## 🎯 Structure d'un Test Unitaire

### Pattern AAA (Arrange-Act-Assert)

```typescript
describe('nomDeLaFonction', () => {
  it('devrait faire X quand Y', () => {
    // 1. ARRANGE : Préparer les données
    const input = { ... };
    
    // 2. ACT : Appeler la fonction
    const result = nomDeLaFonction(input);
    
    // 3. ASSERT : Vérifier le résultat
    expect(result).toBe(expectedValue);
  });
});
```

---

## 📝 Exemple Complet : Test de Sanitization

### Fichier à tester : `lib/sanitization.ts`

```typescript
// tests/lib/sanitization.test.ts

import { sanitizeInput, containsDangerousHTML, sanitizeFilename } from '@/lib/sanitization';

describe('sanitizeInput', () => {
  // Test 1 : Cas nominal
  it('devrait supprimer les balises HTML', () => {
    // ARRANGE
    const input = '<script>alert("XSS")</script>Hello';
    
    // ACT
    const result = sanitizeInput(input);
    
    // ASSERT
    expect(result).toBe('alert("XSS")Hello');
    expect(result).not.toContain('<script>');
  });

  // Test 2 : Cas vide
  it('devrait retourner une chaîne vide pour une entrée vide', () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as any)).toBe('');
    expect(sanitizeInput(undefined as any)).toBe('');
  });

  // Test 3 : Nettoyage des espaces
  it('devrait supprimer les espaces au début et à la fin', () => {
    const input = '  Hello World  ';
    const result = sanitizeInput(input);
    expect(result).toBe('Hello World');
  });

  // Test 4 : Texte sécurisé
  it('devrait préserver le texte normal', () => {
    const input = 'Bonjour, je suis un texte normal';
    const result = sanitizeInput(input);
    expect(result).toBe(input);
  });
});

describe('containsDangerousHTML', () => {
  it('devrait détecter les balises script', () => {
    expect(containsDangerousHTML('<script>alert(1)</script>')).toBe(true);
  });

  it('devrait détecter les gestionnaires d\'événements', () => {
    expect(containsDangerousHTML('<div onclick="alert(1)">Click</div>')).toBe(true);
  });

  it('devrait détecter les URI javascript:', () => {
    expect(containsDangerousHTML('<a href="javascript:alert(1)">Link</a>')).toBe(true);
  });

  it('devrait retourner false pour du texte sécurisé', () => {
    expect(containsDangerousHTML('Bonjour le monde')).toBe(false);
  });

  it('devrait retourner false pour du HTML basique sans danger', () => {
    expect(containsDangerousHTML('<p>Paragraphe</p>')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('devrait supprimer la traversée de chemin', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('etc_passwd');
  });

  it('devrait limiter la longueur à 255 caractères', () => {
    const longName = 'a'.repeat(300);
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(255);
  });

  it('devrait remplacer les caractères spéciaux', () => {
    expect(sanitizeFilename('mon fichier (1).txt')).toBe('mon_fichier_1_.txt');
  });
});
```

---

## 🔧 Techniques de Test

### 1. Tester les Cas Limites

```typescript
describe('rateLimit', () => {
  it('devrait bloquer après 5 tentatives', async () => {
    // Créer 5 requêtes réussies
    for (let i = 0; i < 5; i++) {
      await applyRateLimit(request, 'login');
    }
    
    // La 6ème devrait être bloquée
    const result = await applyRateLimit(request, 'login');
    expect(result.allowed).toBe(false);
  });

  it('devrait permettre les requêtes sous la limite', async () => {
    const result = await applyRateLimit(request, 'login');
    expect(result.allowed).toBe(true);
  });
});
```

### 2. Tester les Erreurs

```typescript
describe('handleApiError', () => {
  it('devrait retourner un message générique en production', () => {
    process.env.NODE_ENV = 'production';
    
    const error = new Error('Détail sensible');
    const result = handleApiError(error);
    
    expect(result.message).toBe('Erreur interne du serveur');
    expect(result.details).toBeUndefined();
  });

  it('devrait retourner les détails en développement', () => {
    process.env.NODE_ENV = 'development';
    
    const error = new Error('Détail sensible');
    const result = handleApiError(error);
    
    expect(result.message).toBe('Détail sensible');
    expect(result.details).toBeDefined();
  });
});
```

### 3. Tester avec des Mocks

```typescript
import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('createAuditLog', () => {
  it('devrait créer une entrée d\'audit', async () => {
    const mockCreate = prisma.auditLog.create as jest.Mock;
    mockCreate.mockResolvedValue({ id: '1', action: 'TEST' });
    
    await createAuditLog({
      userId: 'user-123',
      action: 'TEST',
      resource: 'USER',
      resourceId: 'resource-456',
    });
    
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-123',
        action: 'TEST',
        resource: 'USER',
        resourceId: 'resource-456',
        oldValue: null,
        newValue: null,
        ipAddress: null,
      },
    });
  });
});
```

---

## ✅ Checklist avant de Commiter

- [ ] Tous les tests passent (`npm test`)
- [ ] Coverage > 80% pour le fichier testé
- [ ] Noms de tests descriptifs en français
- [ ] Pattern AAA respecté
- [ ] Pas de code dupliqué entre tests
- [ ] Mocks nettoyés après chaque test
- [ ] Cas limites testés (vide, null, erreurs)

---

## 🚀 Commandes Utiles

```bash
# Lancer tous les tests
npm test

# Lancer un fichier spécifique
npm test -- tests/lib/sanitization.test.ts

# Lancer avec coverage
npm test -- --coverage

# Lancer en mode watch (développement)
npm test -- --watch

# Lancer les tests qui ont échoué en dernier
npm test -- --lastFailed
```

---

## 📊 Template de Fichier de Test

```typescript
/**
 * Tests pour [nom du module]
 * @module tests/[chemin]/[nom].test.ts
 * @description Vérifie le comportement de [fonctionnalité]
 */

import { fonctionATester } from '@/lib/[module]';

describe('[Nom du Module]', () => {
  // Hooks optionnels
  beforeEach(() => {
    // Nettoyer avant chaque test
  });

  afterEach(() => {
    // Nettoyage après chaque test
    jest.clearAllMocks();
  });

  describe('[fonction1]', () => {
    it('devrait [comportement attendu] quand [condition]', () => {
      // ARRANGE
      const input = /* données de test */;
      const expected = /* résultat attendu */;
      
      // ACT
      const result = fonction1(input);
      
      // ASSERT
      expect(result).toBe(expected);
    });

    it('devrait gérer le cas où [cas limite]', () => {
      // ...
    });

    it('devrait rejeter quand [condition d\'erreur]', () => {
      expect(() => fonction1(invalidInput)).toThrow();
    });
  });

  describe('[fonction2]', () => {
    it(/* ... */);
  });
});
```

---

## 🎓 Bonnes Pratiques

### ✅ À FAIRE
- Un seul concept par test
- Noms descriptifs et longs si nécessaire
- Tests indépendants les uns des autres
- Utiliser des constantes pour les valeurs magiques

### ❌ À ÉVITER
- Tester plusieurs choses dans un seul `it()`
- Tests qui dépendent de l'ordre d'exécution
- Mock excessif (tester le mock plutôt que le code)
- Ignorer les tests qui échouent sans les fixer

---

**Prochain Guide** : [Tests d'Intégration API](./guide-tests-integration-api.md)
