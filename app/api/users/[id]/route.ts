import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const UpdateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
  email: z.string().email("Email invalide").optional(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  birthDate: z.string().or(z.date()).optional(),
  birthPlace: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// GET - Détails d'un utilisateur
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
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
    });

    if (!user) {
      return NextResponse.json(
        { message: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération de l'utilisateur" },
      { status: 500 }
    );
  }
}

// PATCH - Modifier un utilisateur
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parse = UpdateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { message: "Entrée invalide", details: parse.error.errors },
        { status: 400 }
      );
    }

    const data = parse.data;

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser && existingUser.id !== id) {
        return NextResponse.json(
          { message: "Cet email est déjà utilisé par un autre utilisateur" },
          { status: 400 }
        );
      }
    }

    // Préparer les données pour la mise à jour
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.role) updateData.role = data.role;
    if (data.birthDate) updateData.birthDate = new Date(data.birthDate);
    if (data.birthPlace) updateData.birthPlace = data.birthPlace;
    if (data.phone) updateData.phone = data.phone;
    if (data.address) updateData.address = data.address;
    
    // Hacher le mot de passe si fourni
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        birthDate: true,
        birthPlace: true,
        phone: true,
        address: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      { message: "Utilisateur modifié avec succès", user },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erreur lors de la modification de l\'utilisateur:', error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Erreur lors de la modification de l'utilisateur" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un utilisateur
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Utilisateur supprimé avec succès" },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { message: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { message: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    );
  }
}
