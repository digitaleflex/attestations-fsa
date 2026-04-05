import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma as db } from "@/lib/prisma";

/**
 * CONFIGURATION STANDARD DES ACCÈS ADMIN
 * 1. S'assure que eflexcloud@gmail.com existe
 * 2. S'assure que admin@fermestandre.com existe
 */
export async function GET() {
  const adminsToCreate = [
    { email: "eflexcloud@gmail.com", name: "Eflex Super Admin" },
    { email: "admin@fermestandre.com", name: "FSA Admin" }
  ];
  const password = "AdminFSA1452.";

  console.log("🔐 [TEMP-SETUP] Stabilisation des accès administrateurs...");

  try {
    const results = [];

    for (const admin of adminsToCreate) {
        // 1. Nettoyage : Supprimer l'ancien compte s'il existe (pour assurer un hash Scrypt propre)
        const existingUser = await db.user.findUnique({
          where: { email: admin.email }
        });

        if (existingUser) {
            console.log(`🧹 Purge de l'ancien compte ${admin.email}...`);
            await db.account.deleteMany({ where: { userId: existingUser.id } });
            await db.session.deleteMany({ where: { userId: existingUser.id } });
            await db.user.delete({ where: { id: existingUser.id } });
        }

        // 2. Création via l'API officielle
        console.log(`✨ Création du compte pour ${admin.email}...`);
        const result = await auth.api.createUser({
          body: {
            email: admin.email,
            password: password,
            name: admin.name,
            role: "admin",
          }
        });

        // 3. Validation de l'email manuellement (car non supporté dans le body de createUser)
        await db.user.update({
            where: { id: result.user.id },
            data: { emailVerified: new Date() }
        });

        results.push({ email: admin.email, id: result.user.id });
    }

    console.log("✅ Tous les comptes administrateurs sont stabilisés !");

    return NextResponse.json({
      success: true,
      message: "Les deux comptes administrateurs sont désormais opérationnels et sécurisés.",
      admins: results
    });

  } catch (error: any) {
    console.error("❌ [TEMP-SETUP] Erreur critique :", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Erreur interne",
      details: error.body || error
    }, { status: 500 });
  }
}
