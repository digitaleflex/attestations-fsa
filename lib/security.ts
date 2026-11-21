// lib/security.ts
// Helpers de sécurité partagés (vérification d'origine, etc.)

/**
 * Vérifie que l'en-tête `Origin` de la requête correspond à l'hôte attendu.
 *
 * - Si l'en-tête `Origin` est absent (requête non-navigateur, même origine
 *   sans en-tête), la requête est autorisée (pas de preuve de cross-site).
 * - Si présent, l'hôte de l'origine doit correspondre à l'hôte de la
 *   requête (en-tête `Host`) ou à l'hôte configuré (`NEXT_PUBLIC_APP_URL` /
 *   `APP_URL`).
 */
export function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const expectedHosts = new Set<string>();
  const host = request.headers.get("host");
  if (host) expectedHosts.add(host.toLowerCase());

  try {
    expectedHosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // ignore
  }

  for (const envKey of ["NEXT_PUBLIC_APP_URL", "APP_URL"]) {
    const value = process.env[envKey];
    if (!value) continue;
    try {
      expectedHosts.add(new URL(value).host.toLowerCase());
    } catch {
      // ignore
    }
  }

  return expectedHosts.has(originUrl.host.toLowerCase());
}

export default { verifyOrigin };
