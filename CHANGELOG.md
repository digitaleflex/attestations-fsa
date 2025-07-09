# Changelog

## [Unreleased]

### Sécurité et validation des entrées (zod)
- Ajout de la validation stricte avec zod sur toutes les routes API sensibles :
  - `app/api/signalement/route.ts` (POST)
  - `app/api/formations/route.ts` (POST)
  - `app/api/auth/register/route.ts` (POST)
  - `app/api/auth/login/route.ts` (POST)
  - `app/api/attestations/route.ts` (POST)
  - Correction du type du champ `type` (enum) dans la validation d'attestation
- Correction des messages d'erreur pour un retour utilisateur plus clair

### Gestion des erreurs (frontend)
- Création et intégration d'un composant `ErrorBoundary` global dans `src/components/ui/ErrorBoundary.tsx` et dans le layout principal
- Personnalisation du message d'erreur affiché à l'utilisateur en cas de crash React

### Documentation et qualité
- Ajout d'une structure de documentation complète dans `docs/README.md`
- Ajout de tests unitaires pédagogiques pour la fonction `cn` dans `src/lib/utils.test.ts`
- Correction de la configuration TypeScript pour la compatibilité avec Jest

### Tests automatisés API
- Création du dossier `tests/api/` pour les tests d'API
- Ajout d'un test automatisé pour la route `POST /api/signalement` avec mock de Prisma
- Correction des tests pour matcher les messages de validation zod

### Divers
- Mise à jour et audit des dépendances npm (`npm audit fix`)
- Amélioration de la gestion des erreurs dans les routes API (log côté serveur)

---

> Ce changelog liste les évolutions majeures et correctifs apportés lors de la session d'amélioration continue. 