// lib/auth.ts
// Configuration unifiée de l'authentification avec Better Auth + Fallback Legacy
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { rawPrisma, prisma } from '@/lib/prisma'
import { nextCookies } from "better-auth/next-js"
import { cookies, headers } from 'next/headers';

// ✅ FIX: Define typed session user to eliminate `as any` casts
export type SessionUser = {
  id: string;
  email: string | null;
  name?: string | null;
  role: 'ADMIN' | 'USER' | string;
  emailVerified?: boolean;
};

export type SessionData = {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
};

// Vérification de la clé secrète
if (!process.env.BETTER_AUTH_SECRET && !process.env.AUTH_SECRET) {
    if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [AUTH WARN] BETTER_AUTH_SECRET or AUTH_SECRET is not defined in environment variables');
    }
}

import { admin } from "better-auth/plugins"

/**
 * Instance d'authentification Better Auth
 */
export const auth = betterAuth({
    database: prismaAdapter(rawPrisma, {
        provider: "postgresql",
    }),
    secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "fallback-secret-for-dev-only",
    baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000"),
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 jours
        updateAge: 60 * 60 * 24 * 1,   // 1 jour
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "user"
            },
            phone: {
                type: "string",
                required: false,
            },
            birthDate: {
                type: "date",
                required: false,
            },
            birthPlace: {
                type: "string",
                required: false,
            },
            address: {
                type: "string",
                required: false,
            }
        }
    },
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
    },
    plugins: [
        nextCookies(),
        admin({
            adminUserIds: ["eflexcloud@gmail.com", "admin@fermestandre.com"]
        })
    ],
    advanced: {
        cookiePrefix: 'better-auth',
    },
    pages: {
        signIn: "/admin/login",
        error: "/admin/login",
    }
});

/**
 * Helper de compatibilité (async)
 */
export const getAuth = async () => auth;

/**
 * Récupère le cookie de session legacy
 */
async function getLegacySessionId(request?: Request): Promise<string | null> {
  if (request) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/admin_session=([^;]+)/);
    return match ? match[1] : null;
  }
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value || null;
}

/**
 * ✅ FIX: Helper to safely extract role from session user
 */
function getUserRole(user: Record<string, unknown>): string | undefined {
  return user.role as string | undefined;
}

/**
 * Vérifie si l'utilisateur est un administrateur (Hybride)
 */
export async function isAdminAuthenticated(request?: Request): Promise<boolean> {
    try {
        // 1. Essai avec Better Auth
        const session = request
            ? await auth.api.getSession({ headers: request.headers })
            : await auth.api.getSession({ headers: await headers() });

        // ✅ FIX: Case-insensitive role check (Better Auth stores 'admin', legacy uses 'ADMIN')
        if (session?.user && getUserRole(session.user)?.toLowerCase() === 'admin') {
            return true;
        }

        // 2. Fallback avec session legacy (Table User uniquement)
        const legacyId = await getLegacySessionId(request);
        if (legacyId) {
            const user = await prisma.user.findUnique({
                where: { id: legacyId },
                select: { id: true, role: true }
            });
            return user?.role?.toUpperCase() === 'ADMIN';
        }

        return false;
    } catch (error: unknown) {
        console.error('[AUTH ERROR] isAdminAuthenticated:', error);
        return false;
    }
}

/**
 * Récupère l'utilisateur actuellement connecté (Hybride)
 */
export async function getCurrentUser(request?: Request): Promise<SessionUser | { id: string; email: string; name: string | null; role: string } | null> {
    try {
        // 1. Essai avec Better Auth
        const session = request
            ? await auth.api.getSession({ headers: request.headers })
            : await auth.api.getSession({ headers: await headers() });

        if (session?.user) {
            return {
                id: session.user.id as string,
                email: session.user.email as string,
                name: session.user.name as string | null | undefined,
                role: getUserRole(session.user) || 'USER',
            } as SessionUser;
        }

        // 2. Fallback avec session legacy
        const legacyId = await getLegacySessionId(request);
        if (legacyId) {
            const user = await prisma.user.findUnique({
                where: { id: legacyId },
                select: { id: true, email: true, name: true, role: true }
            });

            return user || null;
        }

        return null;
    } catch (error: unknown) {
        console.error('[AUTH ERROR] getCurrentUser:', error);
        return null;
    }
}
