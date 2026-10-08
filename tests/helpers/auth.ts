/**
 * Helpers d'authentification pour les tests (issue #11).
 *
 * Complète `tests/helpers/request.ts` : fabriques d'utilisateurs de session et
 * requêtes pré-authentifiées (cookie de session Better Auth factice).
 * Aucun vrai token n'est jamais utilisé ici.
 */
import { makeRequest } from "./request";

/** Sous-ensemble du `SessionUser` de `@/lib/auth` utile aux tests. */
export interface TestSessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified?: boolean;
}

/** Utilisateur standard. */
export function makeSessionUser(
  overrides: Partial<TestSessionUser> = {},
): TestSessionUser {
  return {
    id: "user-test-1",
    email: "user@example.com",
    name: "Utilisateur Test",
    role: "user",
    ...overrides,
  };
}

/** Utilisateur administrateur (`getAdminUser` accepte `admin`, cf. lib/auth). */
export function makeAdminSessionUser(
  overrides: Partial<TestSessionUser> = {},
): TestSessionUser {
  return makeSessionUser({
    id: "admin-test-1",
    email: "admin@example.com",
    name: "Admin Test",
    role: "admin",
    ...overrides,
  });
}

/** En-tête Cookie de session Better Auth (valeur factice). */
export function sessionCookieHeader(
  token = "test-session-token",
): Record<string, string> {
  return { cookie: `better-auth.session_token=${token}` };
}

/**
 * Requête pré-authentifiée, construite sur `makeRequest`.
 * La session elle-même reste mockée côté `auth.api.getSession` ou
 * `getAdminUser` dans chaque fichier de test.
 */
export function makeAuthenticatedRequest(
  body: unknown,
  options: { token?: string; headers?: Record<string, string> } = {},
): Request {
  return makeRequest(body, {
    ...sessionCookieHeader(options.token),
    ...options.headers,
  });
}
