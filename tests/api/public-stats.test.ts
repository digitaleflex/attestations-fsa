import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * #315 — `GET /api/public/stats` : route publique, données publiques.
 *
 * Point central de l'issue : la réponse ne doit exposer AUCUN compteur
 * d'exploitation (`pending`, `totalUsers`), seulement des indicateurs de
 * transparence dérivés de données déjà publiques, et elle doit être quotasée
 * malgré l'exemption de `/api/public` dans `proxy.ts`.
 */

const db = vi.hoisted(() => ({
  attestationCount: vi.fn(),
  settingsFindFirst: vi.fn(),
  userCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    attestation: { count: db.attestationCount },
    settings: { findFirst: db.settingsFindFirst },
    // Conservé pour prouver qu'il n'est plus sollicité : lire le vivier
    // d'inscrits était précisément la fuite corrigée ici.
    user: { count: db.userCount },
  },
}));

import { GET } from "../../app/api/public/stats/route";
import {
  memoryFallbackLimits,
  isFailClosedLimitType,
  __resetInMemoryRateLimitsForTests,
} from "@/lib/rate-limit";

/** Requête brute : la route lit l'IP de confiance, pas un `NextRequest`. */
function callStats(ip = "203.0.113.10") {
  return GET({ headers: new Headers({ "x-forwarded-for": ip }) } as unknown as Request);
}

/** Toutes les clés du JSON, à plat, pour un scan exhaustif de la surface. */
function collectKeys(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (value === null || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    found.add(key);
    collectKeys(child, found);
  }
  return found;
}

/**
 * Vide la fenêtre RÉELLE d'un seau en appelant la route `times` fois.
 *
 * Méthode retenue plutôt qu'un `max` rabaissé à 3 : c'est la taille VRAIE du
 * seau qui est vérifiée. Un quota de test raccourci passerait aussi bien si la
 * route retombait un jour sur le seau générique `api` (100 req/min) — il
 * n'épinglerait donc rien du tout. Ici, 600 requêtes memory-only (deux mocks
 * Prisma, aucune I/O) sont consommées en quelques millisecondes : la boucle
 * reste instantanée, et l'en-tête `Cache-Control: s-maxage=3600` de l'edge
 * absorbe le trafic légitime bien avant d'atteindre ce volume.
 */
async function fillWindow(
  times: number,
  /** Identité présentée à la route, ou index de boucle (rotation d'IP). */
  xffAt: (index: number) => string,
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i++) {
    statuses.push((await callStats(xffAt(i))).status);
  }
  return statuses;
}

/** Facteur de répartition pour faire tourner la partie CLIENT de la XFF. */
const SPARE_CLIENT_IPS = 250;

const originalLimits = { ...memoryFallbackLimits };

beforeEach(() => {
  __resetInMemoryRateLimitsForTests();
  vi.clearAllMocks();
  db.attestationCount.mockResolvedValue(150 as never);
  db.settingsFindFirst.mockResolvedValue({
    targetAttestations: 300,
    targetInscriptions: 500,
    targetValidations: 450,
  } as never);
  db.userCount.mockResolvedValue(9999 as never);
});

afterEach(() => {
  Object.assign(memoryFallbackLimits, originalLimits);
  vi.unstubAllEnvs();
});

describe("GET /api/public/stats — comportement nominal (#315)", () => {
  it("200 — renvoie l'indicateur de transparence et les objectifs publiés", async () => {
    const res = await callStats();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.validated).toBe(150);
    expect(body.targets).toEqual({
      attestations: 300,
      inscriptions: 500,
      validations: 450,
    });
    expect(new Date(body.cachedAt).toISOString()).toBe(body.cachedAt);
  });

  it("200 — replie sur les objectifs par défaut si aucun réglage n'existe", async () => {
    db.settingsFindFirst.mockResolvedValue(null as never);

    const body = await (await callStats()).json();

    expect(body.targets).toEqual({
      attestations: 300,
      inscriptions: 500,
      validations: 450,
    });
  });

  it("aggrège l'avancement en ratio sur l'objectif annoncé, pas sur le nombre d'inscrits", async () => {
    const body = await (await callStats()).json();

    // 150 validées pour un objectif annoncé de 300.
    expect(body.progressRatio).toBe(0.5);
    expect(body.progressRatio).toBe(
      Math.round((body.validated / body.targets.attestations) * 100) / 100,
    );
  });

  it("200 — ne compte que les attestations VALIDATED", async () => {
    await callStats();

    expect(db.attestationCount).toHaveBeenCalledTimes(1);
    expect(db.attestationCount).toHaveBeenCalledWith({
      where: { status: "VALIDATED" },
    });
  });

  it("préserve la politique de cache (l'edge absorbe le trafic légitime)", async () => {
    const res = await callStats();

    const cacheControl = res.headers.get("cache-control") ?? "";
    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("s-maxage=3600");
  });

  it("publie les en-têtes de quota pour que l'appelant puisse s'auto-réguler", async () => {
    const res = await callStats();

    // Le seau RÉELLEMENT consommé est `publicStats` (600), pas le générique
    // `api` (100) : si la route retombait sur ce dernier, l'en-tête afficherait
    // « 100 » et cette comparaison échouerait. C'est l'épinglage du seau.
    expect(res.headers.get("x-ratelimit-limit")).toBe(
      String(memoryFallbackLimits.publicStats.max),
    );
    expect(res.headers.get("x-ratelimit-remaining")).not.toBeNull();
  });

  it("500 — une panne de base ne fuit ni le détail de l'erreur ni de compteur", async () => {
    db.attestationCount.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432") as never);

    const res = await callStats();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      message: "Erreur lors de la récupération des statistiques",
    });
  });
});

describe("GET /api/public/stats — aucune donnée d'exploitation (#315)", () => {
  it("ne publie ni la file de validation ni le nombre d'utilisateurs", async () => {
    const body = await (await callStats()).json();

    expect(body).not.toHaveProperty("pending");
    expect(body).not.toHaveProperty("totalUsers");
    expect(Object.keys(body).sort()).toEqual([
      "cachedAt",
      "progressRatio",
      "targets",
      "validated",
    ]);
  });

  it("scan exhaustif : aucune clé d'exploitation, quel que soit le niveau du JSON", async () => {
    const body = await (await callStats()).json();

    const keys = [...collectKeys(body)];
    for (const forbidden of [
      "pending",
      "totalUsers",
      "total",
      "users",
      "rejected",
      "exams",
      "candidates",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("ne sollicite plus la table des utilisateurs (fuite retirée à la source)", async () => {
    await callStats();

    expect(db.userCount).not.toHaveBeenCalled();
  });

  it("ne publie jamais les valeurs de la base même si elle en contient", async () => {
    db.attestationCount.mockResolvedValue(7 as never);
    db.userCount.mockResolvedValue(42 as never);

    const raw = JSON.stringify(await (await callStats()).json());

    expect(raw).toContain("7");
    // 42 n'apparaît nulle part : c'est le nombre d'inscrits, jamais publié.
    expect(raw).not.toContain("42");
  });
});

describe("GET /api/public/stats — quota (la route est exemptée dans proxy.ts)", () => {
  it("le quota n'est pas assez bas pour casser un usage légitime", () => {
    // 600 req/min, soit 10 req/s : la route est publique, servie par le cache
    // de l'edge (`s-maxage=3600`) et ne fait que deux COUNT. Sur un déploiement
    // auto-hébergé, sans CDN, tout un campus se partagent UNE IP publique —
    // un quota serré casserait des visiteurs légitimes, pas des robots.
    expect(memoryFallbackLimits.publicStats.max).toBe(600);
    expect(memoryFallbackLimits.publicStats.max).toBeGreaterThanOrEqual(60);
    expect(memoryFallbackLimits.publicStats.windowMs).toBe(60_000);
  });

  it("refuse (429) une fois le quota épuisé, sans toucher la base", async () => {
    const quota = memoryFallbackLimits.publicStats.max;
    db.attestationCount.mockClear();

    const accepted = await fillWindow(quota, () => "203.0.113.10");

    // Les 600 requêtes de la fenêtre passent…
    expect(accepted).toEqual(Array<number>(quota).fill(200));

    // …la suivante est refusée.
    const blocked = await callStats("203.0.113.10");

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
    expect((await blocked.json()).code).toBe("RATE_LIMIT_EXCEEDED");
    // Le quota court AVANT les COUNT : un flood ne coûte pas une requête base.
    // 600 appels, toujours 600 COUNT : le 601ᵉ n'a rien touché.
    expect(db.attestationCount).toHaveBeenCalledTimes(quota);
  });

  it("le quota est par IP : une autre IP repart à zéro", async () => {
    const quota = memoryFallbackLimits.publicStats.max;

    // On épuise la fenêtre d'une IP…
    await fillWindow(quota, () => "198.51.100.1");
    expect((await callStats("198.51.100.1")).status).toBe(429);

    // …une IP voisine n'en hérite pas : seau distinct, compteur à zéro.
    expect((await callStats("198.51.100.2")).status).toBe(200);
  });

  it("le spoofing de x-forwarded-for ne crée pas de seau neuf", async () => {
    const quota = memoryFallbackLimits.publicStats.max;
    // Seule la partie DROITE de la chaîne (le saut de confiance) entre dans la
    // clé de comptage. On fait donc tourner la partie pilotée par le client sur
    // toute la fenêtre : un attaquant qui invente une IP à chaque requête.
    await fillWindow(
      quota,
      (i) => `192.0.2.${i % SPARE_CLIENT_IPS}, 203.0.113.10`,
    );

    // IP client INEDITE : 429, elle ne crée pas de seau neuf.
    expect((await callStats("192.0.2.249, 203.0.113.10")).status).toBe(429);
    // IP client DÉJÀ VUE : 429 aussi — un seul et même seau pour les trois.
    expect((await callStats("192.0.2.0, 203.0.113.10")).status).toBe(429);
  });

  it("fail-OPEN : une panne Redis n'abat pas un indicateur de transparence", async () => {
    // `publicStats` n'est PAS dans `FAIL_CLOSED_LIMIT_TYPES` : c'est ce qui
    // garantit que le filet mémoire prenne le relais au lieu d'un 503 pour tout
    // le monde. VOULU, et non un oubli de classement.
    //
    // Pourquoi `false` est le comportement attendu : la route est en lecture
    // seule, anonyme, mise en cache, et ne protège aucun secret ni aucune
    // mutation — l'entrée dans la liste se mérite sur ce critère (« une panne
    // du compteur listenerait-elle un endpoint à ne pas laisser passer ? »).
    // Ici, la seule conséquence d'un 503 serait de mettre l'indicateur de
    // transparence hors ligne pour TOUT le monde, robots compris, pendant
    // toute la panne Upstash : l'inverse de sa fonction. La dégradation
    // assumée est le filet mémoire (compteur réel, mais par instance Node),
    // exactement le même compromis que le seau générique `api` dont cette route
    // a été détachée.
    expect(isFailClosedLimitType("publicStats")).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_FAIL_OPEN", "");

    const res = await callStats();

    expect(res.status).toBe(200);
    expect((await res.json()).validated).toBe(150);
  });
});
