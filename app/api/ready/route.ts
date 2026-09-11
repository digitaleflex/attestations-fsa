import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Readiness probe : vérifie la connectivité à la base de données.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unready" }, { status: 503 });
  }
}
