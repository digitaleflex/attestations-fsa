// lib/auth.ts
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { prisma } from '@/lib/prisma'
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import type { PrismaClient } from "@prisma/client"
import { cookies } from 'next/headers';

// Vérifiez que la clé secrète est définie
if (!process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET is not defined in environment variables')
}

// Configuration du logger personnalisé
const logger = {
  error: (message: string, error?: unknown) => {
    console.error(`[AUTH ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[AUTH WARN] ${message}`, data || '');
  },
  info: (message: string, data?: unknown) => {
    console.log(`[AUTH INFO] ${message}`, data || '');
  },
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[AUTH DEBUG] ${message}`, data || '');
    }
  }
};

// Initialisation de l'authentification
const initAuth = async () => {
  try {
    // Vérification de la connexion à la base de données
    await prisma.$connect();
    logger.info('✅ Connexion à la base de données réussie');
    
    // Vérification du modèle User
    const userCount = await prisma.user.count();
    logger.info(`✅ Modèle User accessible (${userCount} utilisateur(s) trouvé(s))`);
    
    // Configuration de Better Auth
    // Configuration de l'adaptateur Prisma standard
    const adapter = prismaAdapter(prisma, {
      provider: 'postgresql',
      debugLogs: process.env.NODE_ENV !== 'development',
      usePlural: false
    });
    
    // Define auth configuration with proper typing
    const authConfig: BetterAuthOptions = {
      secret: process.env.AUTH_SECRET!,
      database: { adapter },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
      },
      user: {
        additionalFields: {
          role: {
            type: "string",
            defaultValue: "ADMIN"
          }
        }
      },
      // Debug mode is controlled by NODE_ENV automatically in better-auth
      plugins: [nextCookies()],
      
      // Configuration des hooks d'authentification
      hooks: {
        // Hook appelé après l'authentification réussie
        after: async (context: any) => {
          try {
            const { user } = context;
            logger.info(`Authentification réussie pour l'utilisateur: ${user?.email}`);
            return context;
          } catch (error) {
            logger.error('Erreur dans le hook after:', error);
            throw error;
          }
        },
      },
      // Configuration options are complete
    };

    // Add pages configuration
    const pages = {
      signIn: "/admin/login",
      error: "/admin/login",
    };

    logger.info('✅ Configuration Better Auth prête');
    return betterAuth({
      ...authConfig,
      // pages is not in the type definition but is required
      pages,
      // Add redirect callback with proper types
      redirect: ({ url, baseUrl }: { url: string; baseUrl: string }) => {
        return url.startsWith(baseUrl) ? url : baseUrl + "/admin/dashboard";
      },
    });
    
  } catch (error) {
    logger.error('❌ Échec de l\'initialisation de l\'authentification', error);
    throw error;
  }
};

// Type for Prisma client with extensions
// type PrismaClientWithExtensions = {
//   $connect: () => Promise<void>;
//   admin: {
//     findUnique: (params: { 
//       where: { id?: string; email?: string };
//       select?: Record<string, boolean>;
//     }) => Promise<unknown>;
//     create: (params: { data: unknown }) => Promise<unknown>;
//     count: () => Promise<number>;
//   };
//   $disconnect: () => Promise<void>;
// };

// Initialisation de l'authentification
let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
  if (!authInstance) {
    authInstance = await initAuth();
  }
  return authInstance;
};

// Vérification d'authentification admin pour les handlers API
export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  // Doit avoir une session ET être ADMIN
  return !!(session && session.value && role && role.value === 'ADMIN');
}

// Gestion des erreurs globales
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Activation du mode debug si nécessaire
if (process.env.NODE_ENV !== 'production') {
  process.env.DEBUG = 'better-auth:*';
}
