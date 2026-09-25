/**
 * Chargement en lecture seule du snapshot de migration (#259).
 *
 * Garde-fous :
 *  - la lecture s'exécute dans une transaction PostgreSQL `READ ONLY` : toute
 *    tentative d'écriture y échouerait côté serveur ;
 *  - seules des requêtes de sélection (`$queryRaw` / `findMany`) sont issues de
 *    ce module — aucune API d'écriture Prisma n'y est référencée ;
 *  - les colonnes sont filtrées sur leur présence réelle, l'inventaire reste
 *    donc lisible sur une base antérieure aux migrations pdfKey/pdfHash ;
 *  - les identifiants de table et de colonne proviennent de listes blanches.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  MigrationAttestationRow,
  MigrationExamRow,
  MigrationSessionRow,
  MigrationSnapshot,
} from "@/lib/attestations/migration";

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (identifier: string) => {
  if (!SAFE_IDENTIFIER.test(identifier)) throw new Error("Identifiant SQL non autorisé");
  return Prisma.raw(`"${identifier}"`);
};

const ATTESTATION_COLUMNS = [
  "id", "code", "userId", "formationId", "sessionId", "status", "type", "fullName", "email",
  "birthDate", "birthPlace", "startDate", "endDate", "issuedAt", "location", "instructor",
  "issuingCompany", "pdfKey", "pdfHash", "pdfVersion", "pdfGeneratedAt",
  "certificationScore", "certificationMention", "certificationHours", "sealHash", "sealedAt", "sealVersion",
];
const SESSION_COLUMNS = [
  "id", "userId", "examId", "status", "finalScore", "startedAt", "submittedAt", "gradedAt",
];
const EXAM_COLUMNS = ["id", "formationId"];

async function tableColumns(prisma: PrismaClient, table: string): Promise<string[]> {
  if (!SAFE_IDENTIFIER.test(table)) throw new Error("Table SQL non autorisée");
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}
  `);
  return rows.map((row) => row.column_name);
}

async function selectRows<T>(prisma: PrismaClient, table: string, wanted: string[], columns: string[]) {
  const available = new Set(columns);
  const selected = wanted.filter((column) => available.has(column));
  if (!selected.includes("id")) throw new Error(`Colonne id absente de ${table}`);
  const projection = Prisma.join(selected.map(quoteIdentifier));
  return prisma.$queryRaw<T[]>(Prisma.sql`
    SELECT ${projection} FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier("id")} ASC
  `);
}

const NULLABLE_DEFAULTS: Record<string, unknown> = {
  userId: null, sessionId: null, email: null, pdfKey: null, pdfHash: null, pdfVersion: null,
  pdfGeneratedAt: null, certificationScore: null, certificationMention: null, certificationHours: null,
  sealHash: null, sealedAt: null, sealVersion: null,
};

/** Ouvre une transaction `READ ONLY` et charge le snapshot de classification. */
export async function loadMigrationSnapshot(prisma: PrismaClient): Promise<MigrationSnapshot> {
  const [attestationColumns, sessionColumns, examColumns] = await Promise.all([
    tableColumns(prisma, "Attestation"),
    tableColumns(prisma, "ExamSession"),
    tableColumns(prisma, "Exam"),
  ]);
  const [attestationRows, sessionRows, examRows, users, formations] = await Promise.all([
    selectRows<Partial<MigrationAttestationRow>>(prisma, "Attestation", ATTESTATION_COLUMNS, attestationColumns),
    selectRows<Partial<MigrationSessionRow>>(prisma, "ExamSession", SESSION_COLUMNS, sessionColumns),
    selectRows<Partial<MigrationExamRow>>(prisma, "Exam", EXAM_COLUMNS, examColumns),
    prisma.user.findMany({ select: { id: true } }),
    prisma.formation.findMany({ select: { id: true } }),
  ]);
  return {
    attestations: attestationRows.map((row) => ({ ...NULLABLE_DEFAULTS, ...row })) as MigrationAttestationRow[],
    sessions: sessionRows as MigrationSessionRow[],
    exams: examRows as MigrationExamRow[],
    userIds: new Set(users.map((row) => row.id)),
    formationIds: new Set(formations.map((row) => row.id)),
  };
}

/**
 * Exécute `loadMigrationSnapshot` dans une transaction `READ ONLY`.
 * Si le serveur refuse l'instruction, l'échec est remonté : l'outil préfère
 * ne rien classifier plutôt que classifier hors du garde-fou.
 */
export async function loadReadOnlySnapshot(prisma: PrismaClient): Promise<MigrationSnapshot> {
  return prisma.$transaction(async (tx) => {
    await (tx as unknown as PrismaClient).$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    return loadMigrationSnapshot(tx as unknown as PrismaClient);
  });
}
