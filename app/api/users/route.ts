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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("q") || "";
    const skip = (page - 1) * limit;

    // Filtre de recherche
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

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
        orderBy: { createdAt: "desc" },
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
          accountId: sanitizedEmail,
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
