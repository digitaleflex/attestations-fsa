// app/api/users/route.ts
// Gestion des utilisateurs (CRUD admin uniquement)
// FIX: Ajout de l'authentification admin sur toutes les routes
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { applyRateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitization";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.enum(["admin", "user", "ADMIN", "USER"]).optional(),
});

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(200).default(""),
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]).optional(),
  role: z
    .enum(["admin", "user", "ADMIN", "USER"])
    .transform((v) => v.toLowerCase() as "admin" | "user")
    .optional(),
  verified: z.enum(["true", "false"]).optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  to: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  sort: z.enum(["name", "email", "createdAt", "updatedAt"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

// GET - Liste des utilisateurs (Admin uniquement avec pagination)
export async function GET(request: Request) {
  try {
    // Authentification admin requise
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = ListUsersQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      verified: searchParams.get("verified") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      direction: searchParams.get("direction") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètres de recherche invalides" },
        { status: 400 }
      );
    }
    const { page, limit, q: search, status, role, verified, from, to, sort, direction } = parsed.data;
    const skip = (page - 1) * limit;

    // Filtres cumulables (tous optionnels, recherche conservée)
    const where: Prisma.UserWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status ? { status } : {}),
      ...(role ? { role } : {}),
      ...(verified === "true"
        ? { emailVerified: { not: null } }
        : verified === "false"
          ? { emailVerified: null }
          : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    // Exécuter le comptage et la récupération en parallèle pour la performance
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          emailVerified: true,
          birthDate: true,
          birthPlace: true,
          phone: true,
          address: true,
          status: true,
          examId: true,
          examScheduledAt: true,
          exam: {
            select: {
              id: true,
              title: true,
              name: true,
              status: true,
              scheduledAt: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { [sort]: direction },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      items: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/users',
      operation: 'list_users',
    });
  }
}

// POST - Créer un utilisateur (Admin uniquement + rate limiting)
export async function POST(request: Request) {
  try {
    // Authentification admin requise
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    // Rate limiting pour éviter la création massive de comptes
    const rateLimit = await applyRateLimit(request, 'register');
    if (!rateLimit.allowed && rateLimit.response) {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      console.warn(`[SECURITY] Rate limit exceeded for user creation from IP: ${ip}`);
      return rateLimit.response;
    }

    const body = await request.json();
    const parse = CreateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parse.data;

    // SANITIZATION - Clean email input before DB storage
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(name);
    const normalizedRole = role?.toUpperCase() === "ADMIN" ? "admin" : (role || "user");

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Hacher le mot de passe avec l'algorithme compatible Better Auth
    const hashedPassword = await hashPassword(password);

    // Caster en any pour contourner le typage complexe du client étendu de Prisma
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          name: sanitizedName,
          email: sanitizedEmail,
          password: hashedPassword,
          role: normalizedRole,
          emailVerified: new Date(),
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          providerId: 'credential',
          // Better Auth 1.7 : accountId d'un compte credential = user.id (jamais l'email).
          accountId: user.id,
          password: hashedPassword,
        },
      });

      return user;
    });

    return NextResponse.json(
      { 
        message: "Utilisateur créé avec succès", 
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
          createdAt: result.createdAt,
        }
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/users',
      operation: 'create_user',
    });
  }
}
