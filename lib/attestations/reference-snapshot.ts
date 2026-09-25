/**
 * Lecture du snapshot d'export de référence (#255) — STRICTEMENT en lecture.
 *
 * Garde-fous, identiques à `migration-snapshot.ts` :
 *  - transaction PostgreSQL `READ ONLY` : une écriture y échouerait côté
 *    serveur, même en cas de régression ;
 *  - uniquement des `SELECT` : ce fichier ne référence aucune API d'écriture
 *    Prisma ;
 *  - colonnes filtrées sur leur présence réelle (lisible sur une base
 *    antérieure à `pdfKey`/`pdfHash`) ;
 *  - identifiants de table et de colonne issus de listes blanches, valeurs
 *    paramétrées.
 *
 * Les colonnes qui constitueraient de la PII (nom, prénom, email, naissance,
 * lieu de naissance, adresse, téléphone) ne sont JAMAIS sélectionnées : seul un
 * booléen « possède un email » est exporté, calculé ici et jamais la valeur.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  ReferenceAttestationRow,
  ReferenceFormationRow,
  ReferenceSessionRow,
  ReferenceSnapshot,
  ReferenceUserRow,
} from "@/lib/attestations/reference-export";

const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const quoteIdentifier = (identifier: string) => {
  if (!SAFE_IDENTIFIER.test(identifier)) throw new Error("Identifiant SQL non autorisé");
  return Prisma.raw(`"${identifier}"`);
};

const ATTESTATION_COLUMNS = [
  "id", "code", "status", "type", "formationId", "userId", "sessionId", "issuedAt", "startDate",
  "endDate", "email", "pdfKey", "pdfHash", "pdfVersion", "pdfGeneratedAt", "sealHash", "sealVersion",
  "certificationScore",
];
const SESSION_COLUMNS = ["id", "userId", "examId", "status", "startedAt", "submittedAt", "gradedAt"];
const USER_COLUMNS = ["id", "role", "email"];
const FORMATION_COLUMNS = ["id", "name"];

async function tableColumns(prisma: PrismaClient, table: string): Promise<string[]> {
  if (!SAFE_IDENTIFIER.test(table)) throw new Error("Table SQL non autorisée");
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>(Prisma.sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table}
  `);
  return rows.map((row) => row.column_name);
}

async function selectRows<T extends Record<string, unknown>>(
  prisma: PrismaClient,
  table: string,
  wanted: string[],
  columns: string[],
) {
  const available = new Set(columns);
  const selected = wanted.filter((column) => available.has(column));
  if (!selected.includes("id")) throw new Error(`Colonne id absente de ${table}`);
  if (selected.length === 0) return [] as T[];
  const projection = Prisma.join(selected.map(quoteIdentifier));
  return prisma.$queryRaw<T[]>(Prisma.sql`
    SELECT ${projection} FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier("id")} ASC
  `);
}

export async function loadReferenceSnapshot(prisma: PrismaClient): Promise<ReferenceSnapshot> {
  const [attestationColumns, sessionColumns, userColumns, formationColumns] = await Promise.all([
    tableColumns(prisma, "Attestation"),
    tableColumns(prisma, "ExamSession"),
    tableColumns(prisma, "User"),
    tableColumns(prisma, "Formation"),
  ]);

  const [attestationRows, sessionRows, userRows, formationRows] = await Promise.all([
    selectRows<Record<string, unknown>>(prisma, "Attestation", ATTESTATION_COLUMNS, attestationColumns),
    selectRows<Record<string, unknown>>(prisma, "ExamSession", SESSION_COLUMNS, sessionColumns),
    selectRows<Record<string, unknown>>(prisma, "User", USER_COLUMNS, userColumns),
    selectRows<Record<string, unknown>>(prisma, "Formation", FORMATION_COLUMNS, formationColumns),
  ]);

  return {
    attestations: attestationRows.map((row) => {
      // La valeur brute est DETRUCTURÉE : elle ne doit pas sortir d'ici, même
      // en mémoire, pour ne jamais finir dans un rapport par copier-coller.
      const { email, ...rest } = row;
      return { ...rest, hasEmail: typeof email === "string" && email.trim().length > 0 } as unknown as ReferenceAttestationRow;
    }),
    sessions: sessionRows as unknown as ReferenceSessionRow[],
    users: userRows.map((row) => {
      const { email, ...rest } = row;
      return { ...rest, hasEmail: typeof email === "string" && email.trim().length > 0 } as unknown as ReferenceUserRow;
    }),
    formations: formationRows as unknown as ReferenceFormationRow[],
  };
}

/** Charge le snapshot dans une transaction PostgreSQL `READ ONLY`. */
export async function loadReadOnlyReferenceSnapshot(prisma: PrismaClient): Promise<ReferenceSnapshot> {
  return prisma.$transaction(async (tx) => {
    await (tx as unknown as PrismaClient).$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
    return loadReferenceSnapshot(tx as unknown as PrismaClient);
  });
}
