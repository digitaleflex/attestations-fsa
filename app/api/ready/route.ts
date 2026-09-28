import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // 1. PostgreSQL
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.db = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  // 2. Redis (optionnel — absent = non bloquant)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redisStart = Date.now();
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        signal: AbortSignal.timeout(3000),
      });
      checks.redis = { ok: res.ok, latencyMs: Date.now() - redisStart };
    } catch (error) {
      checks.redis = {
        ok: false,
        latencyMs: Date.now() - redisStart,
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "ready" : "degraded", checks, uptime: process.uptime() },
    { status: allOk ? 200 : 503 },
  );
}