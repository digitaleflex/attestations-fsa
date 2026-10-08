/**
 * Fabriques de mocks partagés pour les tests (issue #11).
 *
 * Contrainte Vitest : les fabriques passées à `vi.mock()` sont hissées et ne
 * peuvent importer ce module. Les fonctions ci-dessous s'utilisent donc EN
 * DEUX TEMPS : `vi.hoisted` + `vi.mock` inline dans le fichier de test (voir
 * `tests/api/admin-settings.test.ts`), puis ces presets pour configurer les
 * mocks (`beforeEach`, scénarios).
 */
import { vi } from "vitest";
import type { Mock } from "vitest";
import { makeAdminSessionUser } from "./auth";

/** Mocks du module `@/lib/auth` (`getAdminUser` / `getCurrentUser`). */
export function createAuthMocks() {
  return {
    getAdminUser: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

/** Mock du module `@/lib/audit`. */
export function createAuditMocks() {
  return {
    createAuditLog: vi.fn(),
  };
}

/** Mocks du module `@/lib/rate-limit`. */
export function createRateLimitMocks() {
  return {
    applyRateLimit: vi.fn(),
    applyRateLimitByUser: vi.fn(),
  };
}

/** Scénario : appelant admin authentifié. */
export function givenAdmin(
  getAdminUser: Mock,
  user = makeAdminSessionUser(),
): void {
  getAdminUser.mockResolvedValue(user);
}

/** Scénario : appelant anonyme (401 attendu). */
export function givenAnonymous(getAdminUser: Mock): void {
  getAdminUser.mockResolvedValue(null);
}

/** Scénario : quota OK (même forme que `RateLimitDecision` succès). */
export function allowRateLimit(applyRateLimit: Mock): void {
  applyRateLimit.mockResolvedValue({ success: true });
}

/** Scénario : audit silencioux (résolution sans effet). */
export function silentAudit(createAuditLog: Mock): void {
  createAuditLog.mockResolvedValue(undefined);
}
