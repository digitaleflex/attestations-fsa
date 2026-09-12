/**
 * Helpers de test partagés.
 *
 * `makeRequest` construit une fausse requête compatible avec le sous-ensemble
 * d'API utilisé par nos routes (`req.json()` et `req.headers.get(...)`),
 * sans dépendre de NextRequest.
 */
export function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return {
    json: async () => body,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}
