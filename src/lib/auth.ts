// lib/auth.ts
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { prisma } from "@/lib/prisma"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import type { PrismaClient } from '@prisma/client/edge'

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
    
    // Vérification du modèle Admin
    const adminCount = await (prisma as unknown as { admin: { count: () => Promise<number> } }).admin.count();
    logger.info(`✅ Modèle Admin accessible (${adminCount} admin(s) trouvé(s))`);
    
    // Configuration de Better Auth
    // Configuration de l'adaptateur Prisma avec typage explicite
    const adapter = prismaAdapter(prisma, {
      provider: 'postgresql', // ou 'mysql', 'sqlite', etc. selon votre base de données
      debugLogs: process.env.NODE_ENV !== 'production',
      usePlural: false
    });
    
    // Surcharge des méthodes pour utiliser le modèle Admin
    const originalCreateUser = (adapter as any).createUser;
    if (originalCreateUser) {
      (adapter as any).createUser = async (data: any) => {
        const admin = await (prisma as unknown as { admin: { create: (data: any) => Promise<any> } }).admin.create({
          data: {
            email: data.email,
            name: data.name,
            password: data.password,
            emailVerified: data.emailVerified,
            image: data.image,
            role: 'ADMIN'
          }
        });
        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          image: admin.image,
          emailVerified: admin.emailVerified,
          role: admin.role
        };
      };
    }
    
    const originalGetUser = (adapter as any).getUser;
    if (originalGetUser) {
      (adapter as any).getUser = async (id: string) => {
        const admin = await (prisma as unknown as { admin: { findUnique: (params: { where: { id: string } | { email: string } }) => Promise<any> } }).admin.findUnique({
          where: { id }
        });
        return admin ? {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          image: admin.image,
          emailVerified: admin.emailVerified,
          role: admin.role
        } : null;
      };
    }
    
    const originalGetUserByEmail = (adapter as any).getUserByEmail;
    if (originalGetUserByEmail) {
      (adapter as any).getUserByEmail = async (email: string) => {
        const admin = await (prisma as unknown as { admin: { findUnique: (params: { where: { id: string } | { email: string } }) => Promise<any> } }).admin.findUnique({
          where: { email }
        });
        return admin ? {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          image: admin.image,
          emailVerified: admin.emailVerified,
          role: admin.role
        } : null;
      };
    }
    
    // Define auth configuration with proper typing
    const authConfig: BetterAuthOptions = {
      secret: process.env.AUTH_SECRET!,
      database: { adapter },
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        maxPasswordLength: 128,
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
            
            // Vérifier si l'utilisateur est un administrateur
            if (user?.email) {
              const admin = await prisma.admin.findUnique({
                where: { email: user.email },
                select: { 
                  id: true, 
                  email: true, 
                  name: true,
                  role: true
                }
              });
              
              if (!admin) {
                logger.warn(`Tentative de connexion avec un email non administrateur: ${user.email}`);
              } else {
                // Ajouter des informations supplémentaires à l'utilisateur si nécessaire
                context.user.role = admin.role;
                logger.info(`Rôle de l'utilisateur: ${admin.role}`);
              }
            }
            
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
      // @ts-ignore - pages is not in the type definition but is required
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
type PrismaClientWithExtensions = {
  $connect: () => Promise<void>;
  admin: {
    findUnique: (params: { 
      where: { id?: string; email?: string };
      select?: Record<string, boolean>;
    }) => Promise<any>;
    create: (params: { data: any }) => Promise<any>;
    count: () => Promise<number>;
  };
  $disconnect: () => Promise<void>;
};

// Initialisation de l'authentification
let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
  if (!authInstance) {
    authInstance = await initAuth();
  }
  return authInstance;
};

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
