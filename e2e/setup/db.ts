/**
 * Client Prisma dédié aux tests E2E.
 *
 * Réutilise le même montage que `lib/prisma.ts` (adapter `@prisma/adapter-pg`)
 * pour garantir un comportement identique à celui de l'application.
 * Ne se connecte jamais à la base de dev grâce à `getE2eDatabaseUrl()`.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getE2eDatabaseUrl } from "./env";

export function createE2ePrismaClient(): PrismaClient {
  const connectionString = getE2eDatabaseUrl();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });
}

/** Exécute `fn` avec un client E2E puis le déconnecte systématiquement. */
export async function withE2eDb<T>(
  fn: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  const prisma = createE2ePrismaClient();
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
