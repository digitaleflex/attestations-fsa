import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { createAuditLog, type AuditAction } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { VISIBLE_EXAM_STATUSES } from "@/lib/exams/availability";
import { revokeUserSessions } from "@/lib/account-status";
import {
  grantExamEnrollment,
  revokeExamEnrollment,
} from "@/lib/exams/enrollment";

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
  // #304 — Date de fin de suspension (null = suspension/bannissement
  // sans échéance). Le compte redevient automatiquement utilisable à cette
  // date (lib/account-status.ts).
  suspendedUntil: z
    .string()
    .or(z.date())
    .nullable()
    .optional(),
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

/**
 * Traduit un changement de statut en action d'audit.
 *
 * Le type de retour est `AuditAction` : l'union des actions déclarées dans
 * `lib/audit.ts`. Aucun cast, aucune chaîne inventée — si une action manque à
 * l'union, c'est le compilateur qui le signale.
 */
function resolveAccountStatusAction(
  status: "ACTIVE" | "BLOCKED" | "SUSPENDED" | undefined,
): AuditAction {
  if (status === "ACTIVE") return "ACCOUNT_UNBLOCKED";
  if (status === "BLOCKED" || status === "SUSPENDED") return "ACCOUNT_BLOCKED";
  return "ADMIN_UPDATE_PROFILE";
}

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
    // #304 — Le statut passe enfin du « décor » à l'état réel : il est
    // propagé aux champs Better Auth (banned / banExpires) qui bloquent la
    // connexion, et toutes les sessions vivantes du compte sont révoquées.
    const isBlockingStatus =
      data.status === "BLOCKED" || data.status === "SUSPENDED";
    if (data.status) {
      updateData.status = data.status;
      if (isBlockingStatus) {
        updateData.lastBlockedAt = new Date();
        updateData.banned = true;
        updateData.banReason = data.blockedReason ?? "Compte suspendu par l'administration";
        updateData.banExpires =
          data.suspendedUntil != null ? new Date(data.suspendedUntil) : null;
      } else {
        // Réactivation : on purge tous les marqueurs de blocage.
        updateData.banned = false;
        updateData.banReason = null;
        updateData.banExpires = null;
        updateData.lastBlockedAt = null;
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

      // L'affectation administrative est l'étape explicite qui crée l'inscription
      // à l'examen. Aucun backfill massif n'est effectué lors de la migration.
      // #256 : opérations IDEMPOTENTES (upsert sur (userId, examId) + révocation
      // logique) — un rejeu de la même affectation ne duplique rien et ne
      // supprime jamais l'historique de l'inscription.
      if (resolvedExamId !== undefined) {
        if (resolvedExamId) {
          await grantExamEnrollment({
            userId: id,
            examId: resolvedExamId,
            grantedById: adminUser.id,
            source: "ADMIN_ASSIGNMENT",
            client: tx,
          });
        } else if (currentUser.examId) {
          await revokeExamEnrollment({
            userId: id,
            examId: currentUser.examId,
            revokedById: adminUser.id,
            revokeReason: "Affectation retirée par un administrateur",
            client: tx,
          });
        }
      }

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

    // #304 — Révocation des sessions du compte dont le statut vient de changer.
    // Sans cela, un compte banni conserverait sa session (30 jours) et
    // continuerait à appeler les routes utilisateur.
    if (data.status) {
      const revoked = await revokeUserSessions(id);
      console.log(
        `[ADMIN] Statut ${data.status} appliqué à ${id} — ${revoked} session(s) révoquée(s)`,
      );
    }

    // Enregistrer le log d'audit
    await createAuditLog({
      userId: adminUser.id,
      action: resolveAccountStatusAction(data.status),
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

// #291 — Effacement de compte TRAÇABLE et NON destructif pour les preuves.
//
// ── Ce que le `user.delete()` d'avant faisait réellement ────────────────────
// Vérifié sur le schéma, les migrations ET la base (pg_constraint.confdeltype) :
//
//   Attestation_userId_fkey      ON DELETE SET NULL  (confdeltype = 'n')
//   InternshipRequest_userId_fkey ON DELETE SET NULL  (confdeltype = 'n')
//   ExamSession_userId_fkey      ON DELETE RESTRICT  (confdeltype = 'r')
//   AuditLog_userId_fkey         ON DELETE RESTRICT  (confdeltype = 'r')
//   CorrectionRequest_userId_fkey ON DELETE RESTRICT  (confdeltype = 'r')
//   Reclamation_userId_fkey      ON DELETE RESTRICT  (confdeltype = 'r')
//   Account/Session/TwoFactor_userId_fkey ON DELETE CASCADE (confdeltype = 'c')
//
// Deux conséquences, l'une pire que l'autre :
//
//   1. DESTRUCTIF POUR LE LIEN. La ligne `Attestation` survit, mais `userId`
//      passe à NULL : l'attestation est orphaned, plus rattachable à personne,
//      tout en conservant fullName / birthDate / birthPlace. La preuve
//      officielle reste imprimable mais sa traçabilité est perdue en silence.
//   2. LE DELETE ÉCHOUE. `ExamSession`, `AuditLog`, `CorrectionRequest` et
//      `Reclamation` sont en RESTRICT : `user.delete()` lève une violation de
//      clé étrangère (P2003) dès que le compte a passé un examen — donc pour
//      la quasi-totalité des candidats réels. Le handler remontait un 500 et le
//      compte restait intact : l'effacement était, en pratique, impossible.
//
// ── Pourquoi ANONYMISER et non SUPPRIMER (règle #323) ──────────────────────
// #323 : une attestation émise est une PREUVE OFFICIELLE (code imprimé, PDF
// serveur, hash, sceau HMAC). Elle ne peut ni disparaître, ni être détachée de
// son titulaire. Or `Attestation.fullName`, `email`, `birthDate`, `birthPlace`
// et `userId` font partie de la charge utile scellée : les réécrire invaliderait
// `sealHash` et rendrait un document déjà vérifié par un tiers caduc.
//
// La suppression physique est donc exclue, et l'anonymisation l'est aussi pour
// la ligne `User` : c'est la clé étrangère de `ExamSession`, `AuditLog`,
// `CorrectionRequest` et `Reclamation`, toutes en RESTRICT. Supprimer la ligne
// casserait l'intégrité de l'historique probant ET la piste d'audit.
//
// Ce que fait cet handler :
//   - ANONYMISE la ligne `User` (identifiants, contacts, données de naissance,
//     configuration d'examen, rôle) sans jamais la supprimer ;
//   - PURGE les credentials (Account, TwoFactor, mot de passe, vérifications
//     d'e-mail) et RÉVOQUE les sessions vivantes via `revokeUserSessions`
//     (source unique, `lib/account-status.ts` — aucune implémentation locale) ;
//   - REND le compte inutilisable : `status = BLOCKED` + `banned = true`, le
//     mécanisme de blocage déjà éprouvé par `PATCH` ci-dessus et par
//     `lib/account-status.ts` ;
//   - PRÉSERVE intacts attestations, PDF, hash, sceau, sessions d'examen,
//     réponses, réclamations, demandes de correction et journal d'audit ;
//   - ÉCRIT une ligne d'audit dans la MÊME transaction que l'effacement : il
//     n'existe aucun état dans lequel le compte est anonymisé sans trace.
//
// Ce qui reste deliberément en base, et pourquoi : les identités portées par les
// attestations et les sessions (valeurs scellées d'un document officiel) et le
// `User.id` (clé étrangère de tout l'historique). C'est la limite juridique
// assumée de l'anonymisation ; sa réversibilité est un autre chantier.

/** Motif par défaut : l'IHM d'administration appelle DELETE sans corps. */
const DEFAULT_ERASURE_REASON = "Effacement de compte demandé par l'administration";

/** Raison portée par `banReason` : rend le compte inutilisable, sans l'effacer. */
const ANONYMIZED_BAN_REASON = "Compte anonymisé (effacement RGPD) — accès définitivement fermé";

/**
 * Champs réellement effacés sur la ligne `User`.
 *
 * `password` est mis à NULL : `User.password` porte le hash du mot de passe
 * (Better Auth le duplique dans `Account.password`, purgé ci-dessous). Aucun
 * champ d'authentification n'est laissé derrière : il ne doit rien rester qui
 * permette de se reconnecter.
 */
const ANONYMIZATION_DATA = {
  name: null,
  email: null,
  emailVerified: null,
  image: null,
  password: null,
  address: null,
  birthDate: null,
  birthPlace: null,
  phone: null,
  gender: null,
  examId: null,
  examScheduledAt: null,
  formationId: null,
  role: "user",
  resetPasswordRequired: false,
  // Les lignes `TwoFactor` sont supprimées : on rabat le drapeau pour ne pas
  // laisser un état « 2FA activée » sans aucun secret derrière.
  twoFactorEnabled: false,
  // Compte fermé : même porte que `PATCH` (status bloquant + bannissement
  // Better Auth). `lib/account-status.ts` refuse alors toute session.
  status: "BLOCKED",
  banned: true,
  banReason: ANONYMIZED_BAN_REASON,
  banExpires: null,
} as const;

/** Colonne lue pour décrire l'avant-effacement dans la ligne d'audit. */
const ERASURE_AUDIT_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  banned: true,
  phone: true,
  examId: true,
} as const;

// DELETE - Effacer un compte (anonymisation tracée, jamais de suppression)
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

    // Un administrateur ne peut pas effacer le compte avec lequel il vient
    // d'ouvrir la session : il se fermerait la porte de l'administration.
    if (id === adminUser.id) {
      return NextResponse.json(
        { error: "Un administrateur ne peut pas effacer son propre compte." },
        { status: 409 }
      );
    }

    // Motif de l'effacement (l'IHM d'administration n'en envoie pas : on garde
    // un motif par défaut plutôt que de refuse une action légitime).
    let reason = DEFAULT_ERASURE_REASON;
    try {
      const body = (await request.json()) as unknown;
      if (body && typeof body === "object") {
        const raw = (body as Record<string, unknown>).reason;
        if (typeof raw === "string" && raw.trim().length >= 5) {
          reason = raw.trim();
        }
      }
    } catch {
      // Corps vide ou non JSON : motif par défaut.
    }

    const ipAddress = request.headers.get("x-forwarded-for") || "unknown";

    // Cast en `any` : même contournement de types que le PATCH ci-dessus, le
    // client Prisma étendu n'est pas généré au moment de la vérification.
    const result = await (prisma as any).$transaction(async (tx: any) => {
      const before = await tx.user.findUnique({
        where: { id },
        select: ERASURE_AUDIT_SELECT,
      });
      if (!before) {
        return { kind: "NOT_FOUND" as const };
      }

      // Le dernier administrateur actif ne peut pas être effacé : le compte
      // deviendrait inutilisable et l'institution perdrait tout accès.
      if (String(before.role).toLowerCase() === "admin") {
        const otherAdmins = await tx.user.count({
          where: { role: "admin", id: { not: id }, status: "ACTIVE" },
        });
        if (otherAdmins === 0) {
          return { kind: "LAST_ADMIN" as const };
        }
      }

      // Ce qui est conservé, compté AVANT l'écriture pour être porté dans
      // l'audit. Aucune de ces tables n'est écrite par cet handler.
      const [attestationsKept, examSessionsKept, attestationsOfficial] =
        await Promise.all([
          tx.attestation.count({ where: { userId: id } }),
          tx.examSession.count({ where: { userId: id } }),
          tx.attestation.count({
            where: {
              userId: id,
              status: { in: ["VALIDATED", "CLAIMED", "REVOKED"] },
            },
          }),
        ]);

      // 1. Révocation des sessions vivantes — source unique déjà éprouvée
      //    (lib/account-status.ts), réutilisée telle quelle.
      const revokedSessions = await revokeUserSessions(id, tx);

      // 2. Purge des credentials : plus rien qui permette de se reconnecter.
      //    `Account` porte les mots de passe hashés et les jetons OAuth,
      //    `TwoFactor` le secret TOTP et les codes de secours.
      const purgedAccounts = await tx.account.deleteMany({ where: { userId: id } });
      const purgedTwoFactors = await tx.twoFactor.deleteMany({ where: { userId: id } });
      let purgedVerifications = 0;
      if (before.email) {
        const verifications = await tx.verification.deleteMany({
          where: { identifier: before.email },
        });
        purgedVerifications = verifications?.count ?? 0;
      }

      // 3. Anonymisation de la ligne `User`. La ligne SURVIT : c'est la clé
      //    étrangère de l'historique probant (ExamSession / AuditLog /
      //    CorrectionRequest / Reclamation, toutes en RESTRICT).
      await tx.user.update({ where: { id }, data: { ...ANONYMIZATION_DATA } });

      // 4. La preuve de l'effacement est écrite DANS la transaction : il
      //    n'existe aucun état dans lequel le compte est anonymisé sans trace,
      //    et aucun état où une trace annonce un effacement non effectué.
      //    `userId` = l'ADMIN (clé étrangère valide) ; le compte concerné est
      //    identifié en clair dans `newValue`, jamais par la FK.
      await createAuditLog(
        {
          userId: adminUser.id,
          action: "ACCOUNT_ANONYMIZED",
          resource: "USER",
          resourceId: id,
          oldValue: {
            subjectUserId: before.id,
            name: before.name,
            email: before.email,
            role: before.role,
            status: before.status,
            banned: before.banned,
            examId: before.examId,
          },
          newValue: {
            subjectUserId: before.id,
            adminId: adminUser.id,
            adminName: adminUser.name,
            reason,
            anonymized: true,
            physicalDelete: false,
            anonymizedFields: Object.keys(ANONYMIZATION_DATA),
            purged: {
              sessions: revokedSessions,
              accounts: purgedAccounts?.count ?? 0,
              twoFactors: purgedTwoFactors?.count ?? 0,
              emailVerifications: purgedVerifications,
            },
            preserved: {
              attestations: attestationsKept,
              attestationsOfficiales: attestationsOfficial,
              examSessions: examSessionsKept,
              note:
                "Attestations, PDF, hash, sceaux et sessions d'examen sont conserves intacts " +
                "(regle #323) : la ligne User survit pour ne pas rompre les cles etrangeres.",
            },
          },
          ipAddress,
        },
        tx as Prisma.TransactionClient,
      );

      return {
        kind: "ANONYMIZED" as const,
        revokedSessions,
        preserved: {
          attestations: attestationsKept,
          attestationsOfficiales: attestationsOfficial,
          examSessions: examSessionsKept,
        },
      };
    });

    if (result.kind === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    if (result.kind === "LAST_ADMIN") {
      return NextResponse.json(
        { error: "Impossible d'effacer le dernier administrateur actif." },
        { status: 409 }
      );
    }

    // Aucune donnée personnelle en clair dans les journaux.
    console.log(
      `[ADMIN] Compte anonymise ${id} par ${adminUser.id} — ${result.preserved.attestations} attestation(s) et ${result.preserved.examSessions} session(s) preservees`,
    );

    return NextResponse.json(
      {
        message: "Compte effacé (anonymisé) — attestations et sessions conservées",
        anonymized: true,
        physicalDelete: false,
        reason,
        revokedSessions: result.revokedSessions,
        preserved: result.preserved,
      },
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
    // P2003 : une clé étrangère en RESTRICT empêche l'effacement. La ligne
    // `User` est conservée, donc ce cas ne devrait pas survenir — on le
    // signale explicitement plutôt que de renvoyer une erreur muette.
    if (error instanceof Error && 'code' in error && error.code === "P2003") {
      return NextResponse.json(
        { error: "Effacement impossible : des données probantes référencent encore ce compte." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de l'effacement du compte" },
      { status: 500 }
    );
  }
}
