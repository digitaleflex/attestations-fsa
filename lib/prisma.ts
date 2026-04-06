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
}).$extends({
  query: {
    user: {
      async create({ args, query }) {
        if (args.data && typeof (args.data as any).emailVerified === 'boolean') {
          (args.data as any).emailVerified = (args.data as any).emailVerified ? new Date() : null;
        }
        return query(args);
      },
      async update({ args, query }) {
        if (args.data && typeof (args.data as any).emailVerified === 'boolean') {
          (args.data as any).emailVerified = (args.data as any).emailVerified ? new Date() : null;
        }
        return query(args);
      },
      async upsert({ args, query }) {
        if (args.create && typeof (args.create as any).emailVerified === 'boolean') {
          (args.create as any).emailVerified = (args.create as any).emailVerified ? new Date() : null;
        }
        if (args.update && typeof (args.update as any).emailVerified === 'boolean') {
          (args.update as any).emailVerified = (args.update as any).emailVerified ? new Date() : null;
        }
        return query(args);
      }
    },
    admin: {
      async create({ args, query }) {
        if (args.data && typeof (args.data as any).emailVerified === 'boolean') {
          (args.data as any).emailVerified = (args.data as any).emailVerified ? new Date() : null;
        }
        return query(args);
      }
    }
  }
});

function createPrismaClient(base: any) {
  return base.$extends(withAccelerate());
}

const prismaClient = createPrismaClient(baseClient);

// En développement, on remplace systématiquement le client global pour pick-up les changements de schéma
if (process.env.NODE_ENV !== 'production') {
  // Optionnel : ne le faire que si le client n'a pas les nouveaux modèles ?
  // Non, on force pour être sûr.
  (global as any).prisma = prismaClient;
  (global as any).rawPrisma = baseClient;
}

export const prisma = prismaClient;
export const rawPrisma = baseClient;

// Safe connection tester (non-blocking)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  prisma.$connect()
    .catch((err: any) => console.error('❌ Erreur DB:', err.message));
}

export default prisma;
