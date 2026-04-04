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
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
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