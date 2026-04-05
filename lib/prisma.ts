import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Refreshed instance to pick up new schema fields (e.g. session)
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Create a type-safe Prisma client with extensions
declare global {
  var prisma: ExtendedPrismaClient | undefined;
  var rawPrisma: PrismaClient | undefined;
}

const baseClient = new PrismaClient({
  log: ['error'],
});

function createPrismaClient(base: PrismaClient) {
  return base.$extends(withAccelerate());
}

const prismaClient = createPrismaClient(baseClient);

// En développement, on remplace systématiquement le client global pour pick-up les changements de schéma
if (process.env.NODE_ENV !== 'production') {
  // Optionnel : ne le faire que si le client n'a pas les nouveaux modèles ?
  // Non, on force pour être sûr.
  global.prisma = prismaClient;
  global.rawPrisma = baseClient;
}

export const prisma = prismaClient;
export const rawPrisma = baseClient;

// Safe connection tester (non-blocking)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  prisma.$connect()
    .catch(err => console.error('❌ Erreur DB:', err.message));
}

export default prisma;
