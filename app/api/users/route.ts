import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

const UpdateUserSchema = CreateUserSchema.partial();

// GET - Liste des utilisateurs
export async function GET() {
  try {
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
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
}

// POST - Créer un utilisateur
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parse = CreateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parse.data;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { message: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        name,
        email,
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
  } catch (error) {
    return NextResponse.json(
      { message: "Erreur lors de la création de l'utilisateur" },
      { status: 500 }
    );
  }
}
