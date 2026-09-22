/**
 * scripts/audit-credential-accounts.ts
 *
 * DIAGNOSTIC EN LECTURE SEULE (issue #230).
 *
 * Better Auth 1.7 identifie un compte `credential` en comparant
 * `account.accountId === user.id` (cf. node_modules/better-auth/dist/api/
 * routes/sign-in.mjs:316). Or plusieurs chemins d'écriture historiques de ce
 * dépôt écrivaient `accountId = <email>`, ce qui casse la connexion
 * e-mail + mot de passe (`authClient.signIn.email`).
 *
 * Ce script NE MODIFIE RIEN. Il liste :
 *   - le nombre total de comptes `credential` ;
 *   - ceux dont `accountId` est aligné sur `userId` ;
 *   - ceux désalignés, avec un drapeau « a un mot de passe / n'en a pas » ;
 *   - les utilisateurs possédant plusieurs comptes `credential` (cas ambigu
 *     où un réalignement naïf violerait la contrainte unique
 *     `@@unique([providerId, accountId])`, cf. prisma/schema.prisma).
 *
 * Usage :
 *   npx tsx scripts/audit-credential-accounts.ts
 *   npx tsx scripts/audit-credential-accounts.ts --json
 *   npx tsx scripts/audit-credential-accounts.ts --strict   # exit 1 si désalignés
 *
 * Codes de sortie : 0 = OK, 1 = désalignements trouvés (--strict), 2 = usage.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

export type CredentialAccountRow = {
  id: string;
  userId: string;
  accountId: string;
  password: string | null;
  user: { email: string | null } | null;
};

export type MisalignedAccount = {
  id: string;
  userId: string;
  accountId: string;
  userEmail: string | null;
  hasPassword: boolean;
};

export type MultipleCredentialAccounts = {
  userId: string;
  userEmail: string | null;
  accountIds: string[];
};

export type CredentialAuditReport = {
  total: number;
  aligned: number;
  misaligned: MisalignedAccount[];
  misalignedWithPassword: MisalignedAccount[];
  misalignedWithoutPassword: MisalignedAccount[];
  usersWithMultipleCredentialAccounts: MultipleCredentialAccounts[];
};

/**
 * Analyse pure (sans base) : prend les lignes `Account` credential et renvoie
 * le rapport. Exportée pour être testable sans PostgreSQL.
 */
export function analyzeCredentialAccounts(
  rows: CredentialAccountRow[],
): CredentialAuditReport {
  const misaligned: MisalignedAccount[] = [];
  let aligned = 0;

  for (const row of rows) {
    if (row.accountId === row.userId) {
      aligned += 1;
      continue;
    }
    misaligned.push({
      id: row.id,
      userId: row.userId,
      accountId: row.accountId,
      userEmail: row.user?.email ?? null,
      hasPassword: Boolean(row.password),
    });
  }

  const byUser = new Map<string, CredentialAccountRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const usersWithMultipleCredentialAccounts: MultipleCredentialAccounts[] = [];
  for (const [userId, list] of byUser) {
    if (list.length > 1) {
      usersWithMultipleCredentialAccounts.push({
        userId,
        userEmail: list[0]?.user?.email ?? null,
        accountIds: list.map((a) => a.accountId),
      });
    }
  }

  return {
    total: rows.length,
    aligned,
    misaligned,
    misalignedWithPassword: misaligned.filter((a) => a.hasPassword),
    misalignedWithoutPassword: misaligned.filter((a) => !a.hasPassword),
    usersWithMultipleCredentialAccounts,
  };
}

async function fetchCredentialAccounts(
  prisma: PrismaClient,
): Promise<CredentialAccountRow[]> {
  return prisma.account.findMany({
    where: { providerId: "credential" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      userId: true,
      accountId: true,
      password: true,
      user: { select: { email: true } },
    },
  });
}

type CliOptions = { strict: boolean; json: boolean };

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { strict: false, json: false };
  for (const arg of argv) {
    if (arg === "--strict") options.strict = true;
    else if (arg === "--json") options.json = true;
    else throw new Error(`Option inconnue : ${arg}`);
  }
  return options;
}

function printReport(report: CredentialAuditReport): void {
  console.log("=== Audit des comptes credential (Better Auth) ===");
  console.log(`Comptes credential  : ${report.total}`);
  console.log(`  - alignés         : ${report.aligned} (accountId === userId)`);
  console.log(`  - désalignés      : ${report.misaligned.length}`);
  console.log(
    `      dont réparables : ${report.misalignedWithPassword.length} (mot de passe présent)`,
  );
  console.log(
    `      dont non réparables : ${report.misalignedWithoutPassword.length} (mot de passe absent)`,
  );

  for (const account of report.misaligned) {
    console.log(
      `\n  [désaligné] account.id=${account.id} user=${account.userEmail ?? account.userId}` +
        `\n              accountId actuel = ${JSON.stringify(account.accountId)}` +
        `\n              attendu (= userId) = ${JSON.stringify(account.userId)}` +
        `\n              mot de passe présent : ${account.hasPassword ? "oui" : "NON (non réparable ici)"}`,
    );
  }

  if (report.usersWithMultipleCredentialAccounts.length > 0) {
    console.log(
      `\n⚠️  ${report.usersWithMultipleCredentialAccounts.length} utilisateur(s) ont plusieurs comptes credential :`,
    );
    for (const dup of report.usersWithMultipleCredentialAccounts) {
      console.log(
        `  - ${dup.userEmail ?? dup.userId} : accountIds = ${JSON.stringify(dup.accountIds)}`,
      );
    }
  }

  if (report.misaligned.length === 0) {
    console.log("\n✅ Aucun compte credential désaligné.");
  } else {
    console.log(
      "\nRéparer avec : npx tsx scripts/fix-credential-accounts.ts        (dry-run)" +
        "\n               npx tsx scripts/fix-credential-accounts.ts --apply --yes",
    );
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const rows = await fetchCredentialAccounts(prisma);
    const report = analyzeCredentialAccounts(rows);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printReport(report);
    }

    if (options.strict && report.misaligned.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Garde d'exécution : ne lance rien quand le module est importé par les tests.
if (!process.env.VITEST) {
  main().catch((error: unknown) => {
    console.error(
      "[audit-credential-accounts] Échec :",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
