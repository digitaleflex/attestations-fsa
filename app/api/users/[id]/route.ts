import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { VISIBLE_EXAM_STATUSES } from "@/lib/exams/availability";

const UpdateUserSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").optional(),
  email: z.string().email("Email invalide").optional(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").optional(),
  role: z.enum(["admin", "user"]).optional(),
  birthDate: z.string().or(z.date()).optional(),
  birthPlace: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]).optional(),
  resetPasswordRequired: z.boolean().optional(),
  blockedReason: z.string().optional(),
  // Affectation à un examen (null = retirer l'affectation)
  examId: z
    .string()
    .min(1, "Identifiant d'examen invalide")
    .nullable()
    .optional(),
  examScheduledAt: z
    .string()
    .or(z.date())
    .nullable()
    .optional(),
});

// GET - Détails d'un utilisateur
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ FIX: Add admin authentication
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

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
        status: true,
        lastBlockedAt: true,
        blockedReason: true,
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
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('[GET /api/users/[id] ERROR]', error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'utilisateur" },
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
    // ✅ FIX: Add admin authentication
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parse = UpdateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Entrée invalide", details: parse.error.errors },
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
          { error: "Cet email est déjà utilisé par un autre utilisateur" },
          { status: 400 }
        );
      }
    }

    // Récupérer l'utilisateur actuel avant modification pour le log d'audit
    const currentUser = await prisma.user.findUnique({ 
      where: { id },
      select: {
        status: true,
        role: true,
        email: true,
        examId: true,
        examScheduledAt: true,
      }
    });
    if (!currentUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // ── Affectation à un examen ────────────────────────────────────────────
    // Calcule les valeurs cibles de examId / examScheduledAt avec validation :
    //  - l'examen doit exister et être visible (SCHEDULED/PUBLISHED) ;
    //  - un créneau ne peut être défini sans examen ;
    //  - retirer l'affectation efface aussi le créneau.
    const touchesExam =
      data.examId !== undefined || data.examScheduledAt !== undefined;

    let resolvedExamId: string | null | undefined;
    let resolvedScheduledAt: Date | null | undefined;
    let scheduledExam: { id: string; title: string } | null = null;

    if (touchesExam) {
      const targetExamId =
        data.examId !== undefined ? data.examId : currentUser.examId;

      if (targetExamId) {
        const exam = await prisma.exam.findUnique({
          where: { id: targetExamId },
          select: { id: true, title: true, status: true, scheduledAt: true },
        });

        if (
          !exam ||
          !VISIBLE_EXAM_STATUSES.includes(
            exam.status as (typeof VISIBLE_EXAM_STATUSES)[number],
          )
        ) {
          return NextResponse.json(
            { error: "Examen introuvable ou non disponible" },
            { status: 400 },
          );
        }

        resolvedExamId = exam.id;
        scheduledExam = { id: exam.id, title: exam.title };

        if (data.examScheduledAt !== undefined) {
          if (data.examScheduledAt === null) {
            resolvedScheduledAt = null;
          } else {
            const parsed = new Date(data.examScheduledAt);
            if (Number.isNaN(parsed.getTime())) {
              return NextResponse.json(
                { error: "Date de créneau invalide" },
                { status: 400 },
              );
            }
            resolvedScheduledAt = parsed;
          }
        } else if (data.examId !== undefined) {
          // Nouvelle affectation sans créneau → reprend la date planifiée de l'examen
          resolvedScheduledAt = exam.scheduledAt ?? null;
        }
      } else {
        if (data.examScheduledAt) {
          return NextResponse.json(
            { error: "Un créneau ne peut être défini sans examen" },
            { status: 400 },
          );
        }
        resolvedExamId = null;
        resolvedScheduledAt = null;
      }
    }

    // Préparer les données pour la mise à jour
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.role) updateData.role = data.role;
    if (data.birthDate) updateData.birthDate = new Date(data.birthDate);
    if (data.birthPlace) updateData.birthPlace = data.birthPlace;
    if (data.phone) updateData.phone = data.phone;
    if (data.address) updateData.address = data.address;
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'BLOCKED' || data.status === 'SUSPENDED') {
        updateData.lastBlockedAt = new Date();
      }
    }
    if (data.resetPasswordRequired !== undefined) updateData.resetPasswordRequired = data.resetPasswordRequired;
    if (data.blockedReason !== undefined) updateData.blockedReason = data.blockedReason;
    if (touchesExam) {
      if (resolvedExamId !== undefined) updateData.examId = resolvedExamId;
      if (resolvedScheduledAt !== undefined) {
        updateData.examScheduledAt = resolvedScheduledAt;
      }
    }

    // Hacher le mot de passe si fourni
    let hashedPassword = "";
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
      updateData.password = hashedPassword;
    }

    // Caster en any pour bypasser le problème de types complexes du client étendu de Prisma
    const user = await (prisma as any).$transaction(async (tx: any) => {
      const updatedUser = await tx.user.update({
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
          status: true,
          resetPasswordRequired: true,
          examId: true,
          examScheduledAt: true,
          updatedAt: true,
        },
      });

      // Mettre à jour le compte credential si le mot de passe ou l'email a changé
      if (hashedPassword || data.email) {
        await tx.account.updateMany({
          where: { 
            userId: id,
            providerId: 'credential'
          },
          data: {
            ...(hashedPassword ? { password: hashedPassword } : {}),
            // Better Auth 1.7 : accountId d'un compte credential = user.id (jamais l'email).
            accountId: id
          }
        });
      }

      return updatedUser;
    });

    // Enregistrer le log d'audit
    await createAuditLog({
      userId: adminUser.id,
      action: (data.status ? (data.status === 'ACTIVE' ? 'ACCOUNT_UNBLOCKED' : 'ACCOUNT_BLOCKED') : 'ADMIN_UPDATE_PROFILE') as "ACCOUNT_UNBLOCKED" | "ACCOUNT_BLOCKED" | "ADMIN_UPDATE_PROFILE",
      resource: 'USER',
      resourceId: id,
      oldValue: {
        status: currentUser.status,
        role: currentUser.role,
        examId: currentUser.examId,
        examScheduledAt: currentUser.examScheduledAt,
      },
      newValue: {
        status: user.status,
        role: user.role,
        resetPasswordRequired: user.resetPasswordRequired,
        examId: user.examId,
        examScheduledAt: user.examScheduledAt,
      },
      ipAddress: request.headers.get("x-forwarded-for") || "unknown"
    });

    // Notification in-app lors d'une nouvelle affectation à un examen
    if (scheduledExam && data.examId !== undefined) {
      try {
        const scheduledLabel = user.examScheduledAt
          ? new Date(user.examScheduledAt).toLocaleString("fr-FR")
          : null;

        await createNotification({
          userId: id,
          type: "GENERAL",
          title: "Affectation à un examen",
          message: `Vous avez été affecté à l'examen « ${scheduledExam.title} »${
            scheduledLabel ? ` prévu le ${scheduledLabel}` : ""
          }.`,
          link: "/exams",
          metadata: {
            examId: scheduledExam.id,
            examScheduledAt: user.examScheduledAt
              ? new Date(user.examScheduledAt).toISOString()
              : null,
          },
        });
      } catch (notifyError) {
        console.error("[USER_EXAM_ASSIGN_NOTIFY_ERROR]", notifyError);
      }
    }

    return NextResponse.json(
      { message: "Utilisateur modifié avec succès", user },
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/users/[id] ERROR]', error);
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'utilisateur" },
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
    // ✅ FIX: Add admin authentication
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Non autorisé - Authentification admin requise" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Supprimer les dépendances manuellement si nécessaire ou laisser faire le ON DELETE CASCADE
    // Ici on s'assure de supprimer les comptes et sessions associés
    await prisma.$transaction([
        prisma.account.deleteMany({ where: { userId: id } }),
        prisma.session.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json(
      { message: "Utilisateur supprimé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/users/[id] ERROR]', error);
    if (error instanceof Error && 'code' in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    );
  }
}
