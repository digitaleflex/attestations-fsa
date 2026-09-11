import { NextResponse } from "next/server";

// Liveness probe : très léger, aucune dépendance externe.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", uptime: process.uptime() },
    { status: 200 },
  );
}
