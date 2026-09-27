/**
 * #291 — Export RGPD des données personnelles (droit d'accès, art. 15 RGPD).
 *
 * ── CLOISONNEMENT ──────────────────────────────────────────────────────────
 * L'export est rendu AU SEUL UTILISATEUR CONCERNÉ, et l'identification ne
 * provient jamais de la requête : elle vient de la session, résolue par
 * `getCurrentUser` (le mécanisme de cloisonnement déjà en place dans tout
 * `app/api/user/**` — voir `dashboard-data`, `profile`, `results`). Aucun
 * paramètre d'URL ou d'en-tête ne peut désigner un autre compte : `userId` est
 * une constante locale dérivée de la session, et chaque requête Prisma la
 * reçoit en `where`. Un utilisateur ne peut donc structurellement pas exporter
 * les données d'un autre.
 *
 * ── CE QUE L'EXPORT NE CONTIENT JAMAIS ──────────────────────────────────────
 * Aucun secret, aucun jeton, aucune clé, aucun hash d'authentification. Les
 * `select` Prisma sont explicites et en liste blanche (aucun `include` large) :
 *
 *   - `User.password` (hash), `TwoFactor.secret` / `backupCodes` (secret TOTP) ;
 *   - `Session.token`, `Account.accessToken` / `refreshToken` / `idToken`
 *     / `password` ;
 *   - `Attestation.sealHash` (valeur probante interne du scellement HMAC),
 *     `Attestation.pdfKey` (clé de stockage), `Attestation.pdfUrl` et
 *     `Attestation.pdfHash` (internes du document officiel) ;
 *   - `StoredObject.key` (clé de stockage), `InternshipRequest.cvKey` / `cvUrl`.
 *
 * Ce qui est exporté à la place de ces preuves : uniquement des métadonnées
 * non sensibles (`sealedAt`, `sealVersion`, `pdfVersion`, `pdfGeneratedAt`,
 * `hasDocument`) et les liens vers le document, jamais son contenu interne.
 *
 * Les attestations et sessions d'examen sont exportées en LECTURE : ce sont des
 * données personnelles du titulaire. Elles ne sont ni supprimées, ni modifiées
 * (règle #323).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Version du format d'export : permet d'évoluer sans casser les clients. */
const EXPORT_FORMAT_VERSION = 1;

export async function GET(request: Request) {
  try {
    const sessionUser = await getCurrentUser(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Source UNIQUE de l'assiette : la session. Jamais la requête.
    const userId: string = sessionUser.id;

    const [
      profile,
      attestations,
      examSessions,
      examEnrollments,
      internshipRequests,
      correctionRequests,
      reclamations,
      notifications,
      auditTrail,
      storedObjects,
    ] = await Promise.all([
      // 1. Profil — liste blanche, `password` explicitement absent.
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          status: true,
          banned: true,
          banReason: true,
          banExpires: true,
          resetPasswordRequired: true,
          birthDate: true,
          birthPlace: true,
          phone: true,
          address: true,
          gender: true,
          examId: true,
          examScheduledAt: true,
          formationId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // 2. Attestations — preuve officielle : exportée en lecture, jamais
      //    réécrite. Ni `sealHash`, ni `pdfKey`, ni `pdfUrl`, ni `pdfHash`.
      prisma.attestation.findMany({
        where: { userId },
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          code: true,
          type: true,
          status: true,
          fullName: true,
          email: true,
          birthDate: true,
          birthPlace: true,
          gender: true,
          formationId: true,
          sessionId: true,
          issuedAt: true,
          startDate: true,
          endDate: true,
          location: true,
          instructor: true,
          issuingCompany: true,
          certificationHours: true,
          certificationMention: true,
          certificationObservations: true,
          certificationScore: true,
          stageHours: true,
          stageObservations: true,
          stageScore: true,
          // Cycle de vie (trace d'administration) : utile pour le titulaire.
          deletedAt: true,
          deletedById: true,
          deleteReason: true,
          revokedAt: true,
          revokedById: true,
          revokeReason: true,
          retrogradedAt: true,
          retrogradedById: true,
          retrogradeReason: true,
          // Métadonnées du document SANS la preuve interne ni la clé de stockage.
          pdfVersion: true,
          pdfGeneratedAt: true,
          sealedAt: true,
          sealVersion: true,
        },
      }),

      // 3. Sessions d'examen et réponses associées.
      prisma.examSession.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          examId: true,
          status: true,
          type: true,
          scorePart1: true,
          scorePart2: true,
          scorePart3: true,
          totalScore: true,
          internshipScore: true,
          finalScore: true,
          startedAt: true,
          submittedAt: true,
          gradedAt: true,
          gradedBy: true,
          observations: true,
          answers: true,
          archivedAt: true,
          archiveReason: true,
        },
      }),

      // 4. Inscriptions aux examens.
      prisma.examEnrollment.findMany({
        where: { userId },
        select: {
          id: true,
          examId: true,
          status: true,
          source: true,
          createdAt: true,
          revokedAt: true,
          revokeReason: true,
        },
      }),

      // 5. Demandes de stage rattachées au compte (clé `userId`).
      prisma.internshipRequest.findMany({
        where: { userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          university: true,
          level: true,
          position: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Ni `cvKey` ni `cvUrl` : clés de stockage, pas données personnelles.
        },
      }),

      // 6. Demandes de correction.
      prisma.correctionRequest.findMany({
        where: { userId },
        select: {
          id: true,
          attestationId: true,
          field: true,
          oldValue: true,
          newValue: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // 7. Réclamations.
      prisma.reclamation.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          submissionId: true,
          attestationId: true,
          subject: true,
          message: true,
          adminReply: true,
          field: true,
          oldValue: true,
          newValue: true,
          reason: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      // 8. Notifications.
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          link: true,
          metadata: true,
          createdAt: true,
        },
      }),

      // 9. Journal d'audit des actions menées sur ce compte.
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: "desc" },
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          oldValue: true,
          newValue: true,
          ipAddress: true,
          timestamp: true,
        },
      }),

      // 10. Registre des objets stockés — jamais la clé de stockage.
      prisma.storedObject.findMany({
        where: { ownerUserId: userId },
        select: {
          id: true,
          purpose: true,
          contentType: true,
          sizeBytes: true,
          checksum: true,
          linkedEntityType: true,
          linkedEntityId: true,
          retentionUntil: true,
          createdAt: true,
        },
      }),
    ]);

    if (!profile) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // La preuve officielle est référencée, jamais divulguée.
    const attestationsWithProofPresence = attestations.map((attestation) => ({
      ...attestation,
      hasDocument: Boolean(attestation.pdfVersion !== null),
      isSealed: attestation.sealVersion !== null,
    }));

    return NextResponse.json(
      {
        formatVersion: EXPORT_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        // Rappel explicite du périmètre servi : aucun secret, aucun jeton.
        redaction: [
          "Aucun hash de mot de passe",
          "Aucun secret ou code de double authentification",
          "Aucun jeton de session, d'accès ou de rafraîchissement",
          "Aucune clé de stockage (clé de PDF, clé de CV)",
          "Aucune valeur probante de scellement",
        ],
        profile,
        attestations: attestationsWithProofPresence,
        examSessions,
        examEnrollments,
        internshipRequests,
        correctionRequests,
        reclamations,
        notifications,
        auditTrail,
        storedObjects,
      },
      {
        status: 200,
        headers: {
          // Le document ne doit pas finir dans un cache partagé.
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Erreur API export RGPD:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
