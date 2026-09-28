import { describe, it, expect, vi, beforeEach } from "vitest";

const dbQueryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: dbQueryRaw } }));

import { GET } from "../../app/api/ready/route";

function callGet() {
  return GET();
}

describe("GET /api/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("200 quand DB répond", async () => {
    dbQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.checks.redis).toBeUndefined();
  });

  it("503 quand DB ne répond pas", async () => {
    dbQueryRaw.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.error).toContain("ECONNREFUSED");
  });

  it("inclut le check Redis quand UPSTASH_REDIS_REST_URL est défini", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("PONG", { status: 200 }));
    dbQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await callGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.redis.ok).toBe(true);

    fetchSpy.mockRestore();
  });

  it("503 quand Redis est configuré mais ne répond pas", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));
    dbQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await callGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db.ok).toBe(true);
    expect(body.checks.redis.ok).toBe(false);

    fetchSpy.mockRestore();
  });
});