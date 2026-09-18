import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSealConfigStatus, getSealFingerprintStatus } from "@/lib/crypto/seal";

// Readiness probe : vérifie la connectivité à la base de données ainsi que,
// en production, la configuration du scellement (#155).
//
// Choix de conception : pas d'exception au chargement du module (fragile en
// build/serveurless), mais un gate fail-fast au niveau de la sonde. En
// production, une clé CERT_SEAL_SECRET absente/invalide signifie que les
// attestations émises n'auraient aucune valeur probante : l'instance ne doit
// donc pas être déclarée prête (503) tant que la clé n'est pas fournie, faute
// de quoi l'incident resterait silencieux.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const seal = getSealConfigStatus();
  const sealFingerprint = getSealFingerprintStatus();
  const sealRequired = process.env.NODE_ENV === "production";
  const sealOk = seal.configured || !sealRequired;

  let databaseOk = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }

  const ready = databaseOk && sealOk;
  return NextResponse.json(
    {
      status: ready ? "ready" : "unready",
      checks: {
        database: databaseOk ? "ok" : "error",
        seal: seal.configured ? "ok" : sealRequired ? "missing" : "disabled",
        sealReason: seal.reason ?? null,
        sealRequired,
        // Empreinte non secrète (12 hex d'un digest SHA-256) : seul moyen de
        // vérifier à distance la clé de production. Jamais la clé elle-même.
        sealFingerprint: sealFingerprint.fingerprint,
        sealFingerprintExpected: sealFingerprint.expected,
        sealFingerprintMatch: sealFingerprint.matches,
      },
    },
    { status: ready ? 200 : 503 },
  );
}
