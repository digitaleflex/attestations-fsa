// lib/auth.ts
// Configuration unifiée de l'authentification avec Better Auth + Fallback Legacy
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { rawPrisma, prisma } from "@/lib/prisma";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";

// ✅ FIX: Define typed session user to eliminate `as any` casts
export type SessionUser = {
  id: string;
  email: string | null;
  name?: string | null;
  role: "ADMIN" | "USER" | string;
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
const authSecret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "BETTER_AUTH_SECRET or AUTH_SECRET must be set in production environment",
  );
}
if (!authSecret && process.env.NODE_ENV === "development") {
  console.warn(
    "⚠️ [AUTH WARN] BETTER_AUTH_SECRET or AUTH_SECRET is not defined. Using dev-only fallback.",
  );
}

import { admin, twoFactor } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";

/**
 * Instance d'authentification Better Auth
 */
export const auth = betterAuth({
  database: prismaAdapter(rawPrisma, {
    provider: "postgresql",
  }),
  secret: authSecret || "dev-fallback-secret-do-not-use-in-prod",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000"),
  trustedOrigins: [
    "https://fsa.eurinhash.com",
    "https://verifier.fermestandre.com",
    "https://attestations-fsa.vercel.app",
    "https://*.vercel.app" // ✅ Allow all vercel preview deployments
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24 * 1, // 1 jour
  },
  user: {
    // No additionalFields - Better Auth sign-up endpoint doesn't handle them properly
    // All additional fields (phone, birthPlace, address, birthDate, formationId)
    // are updated after sign-up via /api/user/after-signup
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false, // ✅ Disable mandatory OTP for registration (fixes current UI flow)
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log(`[AUTH] Sanitizing user creation for: ${user.email}`);
          // 🔥 FIX: Prisma attend DateTime? ou null, mais Better Auth envoie false/true.
          // On convertit le booléen en valeur compatible Prisma.
          const sanitizedUser = {
            ...user,
            emailVerified: user.emailVerified === true ? new Date() : null
          };
          return { data: sanitizedUser as any };
        },
        after: async (user) => {
          console.log(`[AUTH] User created successfully: ${user.email}`);
        },
      },
      update: {
        before: async (user) => {
          // 🔥 FIX: Même logique pour l'update
          if (typeof (user as any).emailVerified === 'boolean') {
            (user as any).emailVerified = (user as any).emailVerified ? new Date() : null;
          }
          return { data: user as any };
        }
      }
    },
  },
  plugins: [
    nextCookies(),
    admin({
      adminUserIds: ["eflexcloud@gmail.com", "admin@fermestandre.com"],
    }),
    twoFactor({
      issuer: "Ferme Agro-Piscicole Cité St André",
      totpOptions: {
        digits: 6,
        period: 30,
      },
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          const { emailService } = await import("@/lib/email");
          await emailService.sendTwoFactorOTP(
            user.email,
            user.name || "Administrateur",
            otp,
          );
        },
        period: 5,
        allowedAttempts: 5,
        storeOTP: "encrypted",
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes: "encrypted",
      },
      twoFactorCookieMaxAge: 600, // 10 minutes
      trustDeviceMaxAge: 30 * 24 * 60 * 60, // 30 days
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10, // 10 minutes
      allowedAttempts: 5,
      resendStrategy: "rotate",
      async sendVerificationOTP({ email, otp, type }) {
        // Log OTP pour administration
        const { logOTP } = await import("@/lib/otp-store");
        const { emailService } = await import("@/lib/email");

        if (type === "email-verification") {
          // Vérification d'email lors de l'inscription
          logOTP(email, otp, type);
          await emailService.sendVerificationOTP(
            email,
            email.split("@")[0],
            otp,
          );
        } else if (type === "forget-password") {
          // Réinitialisation du mot de passe
          logOTP(email, otp, type);
          await emailService.sendPasswordResetOTP(
            email,
            email.split("@")[0],
            otp,
          );
        }
      },
    }),
  ],
  advanced: {
    cookiePrefix: "better-auth",
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
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
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/admin_session=([^;]+)/);
    return match ? match[1] : null;
  }
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value || null;
}

/**
 * ✅ FIX: Helper to safely extract role from session user with proper typing
 */
function getUserRole(user: { role?: unknown }): string | undefined {
  if (typeof user.role === "string") {
    return user.role;
  }
  return undefined;
}

/**
 * 🔒 Récupère l'admin authentifié en un seul appel atomique
 * Retourne null si non authentifié ou non admin
 * 
 * @param request - La requête HTTP (obligatoire pour les routes API)
 * @returns L'utilisateur admin ou null
 */
export async function getAdminUser(request: Request): Promise<SessionUser | null> {
  try {
    // 1. Essai avec Better Auth
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user && getUserRole(session.user)?.toLowerCase() === "admin") {
      return {
        id: session.user.id as string,
        email: session.user.email as string,
        name: (session.user.name as string | null | undefined) || null,
        role: getUserRole(session.user) || "ADMIN",
        emailVerified: !!session.user.emailVerified,
      };
    }

    // 2. Fallback avec session legacy (Table User uniquement)
    const legacyId = await getLegacySessionId(request);
    if (legacyId) {
      const user = await prisma.user.findUnique({
        where: { id: legacyId },
        select: { id: true, email: true, name: true, role: true },
      });
      
      if (user?.role?.toUpperCase() === "ADMIN") {
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: false,
        };
      }
    }

    return null;
  } catch (error: unknown) {
    console.error("[AUTH ERROR] getAdminUser:", error);
    return null;
  }
}

/**
 * Vérifie si l'utilisateur est un administrateur (Hybride)
 * @deprecated Utilisez getAdminUser() pour obtenir l'utilisateur ET vérifier le rôle en un seul appel
 */
export async function isAdminAuthenticated(
  request: Request,
): Promise<boolean> {
  const adminUser = await getAdminUser(request);
  return adminUser !== null;
}

/**
 * Récupère l'utilisateur actuellement connecté (Hybride)
 */
export async function getCurrentUser(
  request?: Request,
): Promise<
  | SessionUser
  | { id: string; email: string; name: string | null; role: string }
  | null
> {
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
        role: getUserRole(session.user) || "USER",
        emailVerified: !!session.user.emailVerified,
      } as SessionUser;
    }

    // 2. Fallback avec session legacy
    const legacyId = await getLegacySessionId(request);
    if (legacyId) {
      const user = await prisma.user.findUnique({
        where: { id: legacyId },
        select: { id: true, email: true, name: true, role: true },
      });

      return user || null;
    }

    return null;
  } catch (error: unknown) {
    console.error("[AUTH ERROR] getCurrentUser:", error);
    return null;
  }
}
