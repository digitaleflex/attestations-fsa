// lib/auth.ts
// Configuration unifiée de l'authentification avec Better Auth + Fallback Legacy
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { rawPrisma } from "@/lib/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { normalizeEmailVerified, isEmailVerified } from "@/lib/email-verified";

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
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.*",
    "http://192.168.0.*",
    "https://*.ngrok-free.app",
    "https://*.loca.lt",
    "https://*.vercel.app",
    "https://fsa.eurin.tech",
    "http://fsa.eurin.tech",
    ...(process.env.NEXT_PUBLIC_APP_URL
      ? [process.env.NEXT_PUBLIC_APP_URL]
      : []),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
      : []),
  ],
  user: {
    // No additionalFields - Better Auth sign-up endpoint doesn't handle them properly
    // All additional fields (phone, birthPlace, address, birthDate, formationId)
    // are updated after sign-up via /api/user/after-signup
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log(`[AUTH] Sanitizing user creation for: ${user.email}`);
          // Prisma attend DateTime? ou null, mais Better Auth envoie boolean.
          // Conversion centralisée (voir lib/email-verified.ts).
          const sanitizedUser = normalizeEmailVerified({ ...user });
          return { data: sanitizedUser as any };
        },
        after: async (user) => {
          console.log(`[AUTH] User created successfully: ${user.email}`);
        },
      },
      update: {
        before: async (user) => {
          // Même logique centralisée pour l'update.
          const normalized = normalizeEmailVerified({ ...(user as any) });
          (user as any).emailVerified = (normalized as any).emailVerified;
          return { data: user as any };
        },
      },
    },
  },
  plugins: [
    nextCookies(),
    admin({
      adminUserIds: [
        ...(process.env.ADMIN_USER_IDS
          ? process.env.ADMIN_USER_IDS.split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : []),
      ],
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
        storeOTP: process.env.NODE_ENV === "production" ? "encrypted" : "plain",
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes:
          process.env.NODE_ENV === "production" ? "encrypted" : "plain",
      },
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
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
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours
    updateAge: 60 * 60 * 24 * 1, // 1 jour
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
});

/**
 * Helper de compatibilité (async)
 */
export const getAuth = async () => auth;

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
export async function getAdminUser(
  request: Request,
): Promise<SessionUser | null> {
  try {
    // 1. Essai avec Better Auth
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user) {
      const role = getUserRole(session.user);
      if (role?.toLowerCase() !== "admin") return null;
      return {
        id: session.user.id as string,
        email: session.user.email as string,
        name: (session.user.name as string | null | undefined) || null,
        role: "admin",
        emailVerified: isEmailVerified(session.user.emailVerified),
      };
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
export async function isAdminAuthenticated(request: Request): Promise<boolean> {
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
      const role = getUserRole(session.user) ?? "user";
      return {
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string | null | undefined,
        role,
        emailVerified: isEmailVerified(session.user.emailVerified),
      } as SessionUser;
    }

    return null;
  } catch (error: any) {
    console.error("[AUTH ERROR] getCurrentUser:", error);
    // On log l'erreur spécifique pour diagnostiquer "Failed to get session"
    if (error.message?.includes("session")) {
      console.error("DEBUG SESSION DATA:", {
        headers: request?.headers?.get("cookie") ? "PRESENT" : "MISSING",
        env: process.env.NODE_ENV,
      });
    }
    return null;
  }
}
