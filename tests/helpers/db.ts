/**
 * Helpers de base de données (mockée) pour les tests (issue #11).
 *
 * Les tests mockent `@/lib/prisma` via `vi.mock` + `vi.hoisted` (aucune
 * connexion réelle) ; ce module ne fournit que des utilitaires de gestion de
 * ces mocks, typés pour `tsc --noEmit` strict.
 */
import type { Mock } from "vitest";

/**
 * Remet les mocks à zéro : historique ET implémentations effacés.
 * À appeler en début de suite quand chaque test re-stubbe ses mocks
 * (pattern `beforeEach` + `mockResolvedValue` des tests `tests/api/*`).
 */
export function resetDbMocks(...mocks: Mock[]): void {
  for (const mock of mocks) mock.mockReset();
}

/**
 * Efface uniquement l'historique d'appels, sans toucher aux implémentations.
 * Utile pour compter les appels d'une action précise en cours de test.
 */
export function clearDbMockHistory(...mocks: Mock[]): void {
  for (const mock of mocks) mock.mockClear();
}
