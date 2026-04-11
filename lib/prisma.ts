import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Refreshed instance to pick up new schema fields (e.g. session)
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Create a type-safe Prisma client with extensions
declare global {
  var prisma: ExtendedPrismaClient | undefined;
  var rawPrisma: PrismaClient | undefined;
}

// Configuration du client Prisma avec support pour la connexion directe en Dev
const isDev = process.env.NODE_ENV === 'development';
const directUrl = process.env.DIRECT_DATABASE_URL;
const pooledUrl = process.env.DATABASE_URL;

// On n'utilise DIRECT_DATABASE_URL que s'il est défini ET qu'il ne s'agit pas du placeholder
const isValidDirectUrl = directUrl && !directUrl.includes('votre_url_');
const databaseUrl = isDev ? (isValidDirectUrl ? directUrl : pooledUrl) : pooledUrl;

if (isDev) {
  console.log(`🔌 [PRISMA] Engine: ${process.env.DIRECT_DATABASE_URL ? 'DIRECT' : 'POOLED'}`);
  console.log(`🔗 [PRISMA] Protocol: ${databaseUrl?.split('://')[0]}`);
}

const baseClient = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: databaseUrl
    }
  }
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
  // ✅ FIX: Disable Accelerate in development to avoid P5000 errors on local network
  if (process.env.NODE_ENV === 'development') {
    return base;
  }
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
