import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

// Extend the PrismaClient type to include our custom extensions
type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// Create a type-safe Prisma client with extensions
declare global {
   
  var prisma: ExtendedPrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  }).$extends(withAccelerate());
}

const prismaClient = createPrismaClient();

export const prisma = global.prisma || prismaClient;

// En développement, évite de créer plusieurs instances de Prisma Client
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
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