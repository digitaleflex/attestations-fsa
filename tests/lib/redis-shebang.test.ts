import { describe, it, expect, vi } from "vitest";

import { adaptNativeClient, stripUpstashShebang } from "@/lib/redis";

/**
 * Bug CI du 17/10 → 29/10 : `@upstash/ratelimit@2.2.0` préfixe ses scripts Lua
 * de `#!lua flags=allow-key-locking`, une métadonnée comprise par le serveur
 * Upstash mais refusée par Redis standard (vérifié sur 7.4 et 8.10) :
 *
 *   ERR Unexpected flag in script shebang: allow-key-locking
 *
 * En E2E, `REDIS_HOST` est défini → `lib/redis.ts` utilise ioredis, qui envoie
 * le script brut. Chaque vérification de rate-limit échouait donc et basculait
 * en mémoire — d'où les tests d'authentification en échec.
 *
 * La preuve avec la vraie bibliothèque a été faite hors CI (Redis 7 et 8 :
 * 3 requêtes autorisées puis refus). Ces tests verrouillent la mécanique.
 */

const SHEBANG_SCRIPT =
  "#!lua flags=allow-key-locking\nreturn redis.call('GET', KEYS[1])";

describe("stripUpstashShebang", () => {
  it("retire l'en-tête Upstash", () => {
    expect(stripUpstashShebang(SHEBANG_SCRIPT)).toBe(
      "return redis.call('GET', KEYS[1])",
    );
  });

  it("laisse intact un script sans en-tête", () => {
    const script = "return redis.call('GET', KEYS[1])";
    expect(stripUpstashShebang(script)).toBe(script);
  });

  it("ne retire qu'un en-tête situé au tout début", () => {
    const script = "return 1\n#!lua flags=allow-key-locking\nreturn 2";
    expect(stripUpstashShebang(script)).toBe(script);
  });

  it("ne mange pas la première ligne de code après l'en-tête", () => {
    const script = "#!lua flags=allow-key-locking\nlocal a = 1\nreturn a";
    expect(stripUpstashShebang(script)).toBe("local a = 1\nreturn a");
  });
});

describe("adaptNativeClient — le script partant vers ioredis est nettoyé", () => {
  function fakeClient() {
    const evalSpy = vi.fn(async (..._args: unknown[]) => 1);
    const client = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      ping: vi.fn(),
      eval: evalSpy,
      evalsha: vi.fn(),
      incr: vi.fn(),
      incrby: vi.fn(),
      expire: vi.fn(),
      ttl: vi.fn(),
    };
    return client;
  }

  it("eval() retire le shebang avant l'envoi", async () => {
    const raw = fakeClient();
    const adapter = adaptNativeClient(raw as never);

    await adapter.eval(SHEBANG_SCRIPT, ["rate:key"], [1, 60]);

    expect(raw.eval).toHaveBeenCalledTimes(1);
    const [script, keyCount, ...rest] = raw.eval.mock.calls[0] as unknown as [
      string,
      number,
      ...unknown[],
    ];
    expect(script).toBe("return redis.call('GET', KEYS[1])");
    expect(keyCount).toBe(1);
    expect(rest).toEqual(["rate:key", 1, 60]);
  });

  it("transmet correctement le nombre de clés et les arguments", async () => {
    const raw = fakeClient();
    const adapter = adaptNativeClient(raw as never);

    await adapter.eval("return 1", ["a", "b"], ["x"]);

    expect(raw.eval).toHaveBeenCalledWith("return 1", 2, "a", "b", "x");
  });

  it("evalsha() est laissé tel quel (le fallback NOSCRIPT fait le reste)", async () => {
    const raw = fakeClient();
    const adapter = adaptNativeClient(raw as never);

    await adapter.evalsha("abc123", ["k"], [1]);

    expect(raw.evalsha).toHaveBeenCalledWith("abc123", 1, "k", 1);
  });
});
