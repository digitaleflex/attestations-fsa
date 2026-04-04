// app/api/users/route.ts
// Gestion des utilisateurs (CRUD admin uniquement)
// ✅ FIX: Ajout de l'authentification admin sur toutes les routes
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isAdminAuthenticated } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { applyRateLimit } from "@/lib/rate-limit";
import { sanitizeInput } from "@/lib/sanitization";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

// GET - Liste des utilisateurs (✅ Admin uniquement)
export async function GET(request: Request) {
  try {
    // ✅ Authentification admin requise
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
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
  } catch (error: any) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return handleApiError(error, {
      route: '/api/users',
      operation: 'list_users',
    });
  }
}

// POST - Créer un utilisateur (✅ Admin uniquement + rate limiting)
export async function POST(request: Request) {
  try {
    // ✅ Authentification admin requise
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    // ✅ Rate limiting pour éviter la création massive de comptes
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

    // ✅ SANITIZATION - Clean email input before DB storage
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(name);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email: sanitizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name: sanitizedName,
        email: sanitizedEmail,
        password: hashedPassword,
        role: role || "USER",
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
      { message: "Utilisateur créé avec succès", user },
      { status: 201 }
    );
  } catch (error: any) {
    return handleApiError(error, {
      route: '/api/users',
      operation: 'create_user',
    });
  }
}
