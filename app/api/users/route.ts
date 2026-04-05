// app/api/users/route.ts
// Gestion des utilisateurs (CRUD admin uniquement)
// FIX: Ajout de l'authentification admin sur toutes les routes
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { applyRateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitization";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caracteres"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
  role: z.enum(["admin", "user"]).optional(),
});

// GET - Liste des utilisateurs (Admin uniquement)
export async function GET() {
  try {
    // Authentification admin requise
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorise - Authentification admin requise" },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
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
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (error: unknown) {
    console.error('Erreur lors de la recuperation des utilisateurs:', error);
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/users',
      operation: 'list_users',
    });
  }
}

// POST - Creer un utilisateur (Admin uniquement + rate limiting)
export async function POST(request: Request) {
  try {
    // Authentification admin requise
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorise - Authentification admin requise" },
        { status: 401 }
      );
    }

    // Rate limiting pour eviter la creation massive de comptes
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
        { error: "Entree invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parse.data;

    // SANITIZATION - Clean email input before DB storage
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(name);

    // Verifier si l'utilisateur existe deja
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe deja" },
        { status: 400 }
      );
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Creer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        password: hashedPassword,
        role: role || "user",
        emailVerified: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Utilisateur cree avec succes", user },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error instanceof Error ? error : new Error(String(error)), {
      route: '/api/users',
      operation: 'create_user',
    });
  }
}
