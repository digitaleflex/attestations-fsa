import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from 'next/headers';

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

    const { field, newValue, attestationId, reason } = await req.json();

    if (!field || !newValue) {
      return new NextResponse("Données manquantes", { status: 400 });
    }

    // Créer la demande de correction
    const request = await prisma.correctionRequest.create({
      data: {
        userId,
        attestationId,
        field,
        newValue,
        reason,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Demande de correction envoyée !",
      data: request,
    });
  } catch (error) {
    console.error("[CORRECTION_REQUEST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
