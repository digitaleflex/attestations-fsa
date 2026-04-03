import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';

// Helper pour vérifier l'authentification user (copié du pattern existant)
async function isAuthenticatedUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const role = cookieStore.get('user_role');
  
  if (!session || !session.value) return null;
  if (role?.value !== 'USER') return null;
  
  return session.value;
}

export async function POST(req: Request) {
  try {
    const userId = await isAuthenticatedUser();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { codePart } = await req.json();

    if (!codePart || codePart.length < 5) {
      return new NextResponse("Code trop court (min 5 caractères)", { status: 400 });
    }

    // Rechercher une attestation qui se termine par ce code
    const attestation = await prisma.attestation.findFirst({
      where: {
        code: {
          endsWith: codePart.trim(),
        },
        userId: null, // Uniquement si pas déjà liée
      },
    });

    if (!attestation) {
      return new NextResponse("Aucune attestation correspondante trouvée ou déjà liée.", { status: 404 });
    }

    // Lier l'attestation à l'utilisateur
    await prisma.attestation.update({
      where: { id: attestation.id },
      data: { userId: userId },
    });

    // Mettre à jour le profil de l'utilisateur avec les données de l'attestation
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: attestation.fullName,
        birthDate: attestation.birthDate,
        birthPlace: attestation.birthPlace,
        gender: attestation.gender,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Attestation liée avec succès !",
      data: {
        fullName: attestation.fullName,
        birthDate: attestation.birthDate,
        birthPlace: attestation.birthPlace,
      },
    });
  } catch (error) {
    console.error("[CLAIM_CODE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
