import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Extend the PrismaClient type to include our custom extensions
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Create a type-safe Prisma client with extensions
declare global {
  var prisma: ExtendedPrismaClient | undefined;
  var rawPrisma: PrismaClient | undefined;
}

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

function createPrismaClient(base: PrismaClient) {
  return base.$extends(withAccelerate());
}

const prismaClient = createPrismaClient(baseClient);

export const prisma = global.prisma || prismaClient;
export const rawPrisma = global.rawPrisma || baseClient;

// En développement, évite de créer plusieurs instances de Prisma Client
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
  global.rawPrisma = rawPrisma;
}

// Fonction pour tester la connexion à la base de données
const testConnection = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connecté à la base de données avec succès');
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('❌ Erreur de connexion à la base de données:', error.message);
    } else {
      console.error('❌ Une erreur inconnue est survenue lors de la connexion à la base de données');
    }
    process.exit(1);
  }
};

// Test the connection when the module is loaded
if (process.env.NODE_ENV !== 'test') {
  testConnection().catch(console.error);
}

export default prisma;