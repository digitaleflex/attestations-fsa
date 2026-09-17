/**
 * scripts/fix-credential-accounts.ts
 *
 * RÉPARATION IDEMPOTENTE des comptes `credential` désalignés (issue #230).
 *
 * Contexte
 * --------
 * Better Auth 1.7 exige `account.accountId === user.id` pour authentifier un
 * mot de passe (cf. better-auth/dist/api/routes/sign-in.mjs:316). Les données
 * créées par d'anciens chemins portent `accountId = <email>`, ce qui rend
 * `authClient.signIn.email` inopérant pour ces comptes. Ce script réaligne
 * `accountId` sur `userId` SANS jamais toucher au mot de passe.
 *
 * ⚠️ Chemin d'authentification en production : une réparation ratée peut
 * verrouiller un compte. Garde-fous :
 *   - `--dry-run` par défaut : aucune écriture sans `--apply` ;
 *   - `--apply` exige une confirmation (`--yes`, ou saisie interactive) ;
 *   - relecture de la base juste avant écriture (pas de plan périmé) ;
 *   - un compte sans mot de passe est SIGNALÉ, jamais modifié (le réaligner ne
 *     le rendrait pas utilisable et masquerait le problème) ;
 *   - un conflit de contrainte unique `@@unique([providerId, accountId])`
 *     (plusieurs comptes credential pour un même user) est SIGNALÉ, pas forcé ;
 *   - chaque écriture est isolée : un échec n'interrompt pas les suivantes.
 *
 * Procédure recommandée
 * ---------------------
 *   1. Sauvegarder la table Account (backup base).
 *   2. Diagnostiquer : npx tsx scripts/audit-credential-accounts.ts
 *   3. Simuler       : npx tsx scripts/fix-credential-accounts.ts
 *   4. Appliquer     : npx tsx scripts/fix-credential-accounts.ts --apply --yes
 *   5. Re-diagnostiquer puis tester une connexion e-mail + mot de passe.
 *
 * Usage :
 *   npx tsx scripts/fix-credential-accounts.ts                 # dry-run
 *   npx tsx scripts/fix-credential-accounts.ts --apply --yes   # écrit
 *   npx tsx scripts/fix-credential-accounts.ts --apply         # confirmation interactive
 *
 * Codes de sortie : 0 = OK, 1 = échec(s) d'écriture ou erreur, 2 = refus/usage.
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

export type RepairAction = "repair" | "skip-no-password" | "skip-conflict";

export type RepairDecision = {
  action: RepairAction;
  rowId: string;
  userId: string;
  userEmail: string | null;
  currentAccountId: string;
  /** Présent uniquement si action === "repair". */
  targetAccountId?: string;
  reason: string;
};

export type RepairPlan = {
  decisions: RepairDecision[];
  toRepair: RepairDecision[];
  skipped: RepairDecision[];
};

/**
 * Construit le plan de réparation à partir des comptes `credential`.
 * Fonction PURE (aucune base) : testable sans PostgreSQL.
 *
 * Règle : pour un utilisateur, on ne réaligne qu'UN seul compte vers
 * `accountId = userId`, car la contrainte `@@unique([providerId, accountId])`
 * interdit deux lignes credential partageant le même accountId.
 */
export function planCredentialAccountRepairs(
  rows: CredentialAccountRow[],
): RepairPlan {
  const decisions: RepairDecision[] = [];

  const byUser = new Map<string, CredentialAccountRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  for (const [userId, accounts] of byUser) {
    const sorted = [...accounts].sort((a, b) => a.id.localeCompare(b.id));
    // Le slot `accountId === userId` est déjà occupé pour cet utilisateur ?
    let slotTaken = sorted.some((a) => a.accountId === userId);

    for (const account of sorted) {
      if (account.accountId === account.userId) {
        continue; // déjà aligné
      }

      const base = {
        rowId: account.id,
        userId: account.userId,
        userEmail: account.user?.email ?? null,
        currentAccountId: account.accountId,
      };

      if (!account.password) {
        decisions.push({
          ...base,
          action: "skip-no-password",
          reason:
            "Mot de passe absent : non réparable par réalignement. À traiter manuellement (réinitialisation).",
        });
        continue;
      }

      if (slotTaken) {
        decisions.push({
          ...base,
          action: "skip-conflict",
          reason:
            "Un autre compte credential de cet utilisateur occupe déjà accountId = userId " +
            "(contrainte unique). Fusion manuelle requise.",
        });
        continue;
      }

      decisions.push({
        ...base,
        action: "repair",
        targetAccountId: userId,
        reason: "Réalignement accountId sur userId (convention Better Auth 1.7).",
      });
      slotTaken = true;
    }
  }

  const toRepair = decisions.filter((d) => d.action === "repair");
  const skipped = decisions.filter((d) => d.action !== "repair");
  return { decisions, toRepair, skipped };
}

export interface CredentialAccountStore {
  account: {
    findMany(args: {
      where: { providerId: string };
      orderBy: { id: "asc" };
      select: {
        id: true;
        userId: true;
        accountId: true;
        password: true;
        user: { select: { email: true } };
      };
    }): Promise<CredentialAccountRow[]>;
    update(args: {
      where: { id: string };
      data: { accountId: string; updatedAt: Date };
    }): Promise<unknown>;
  };
}

export type ApplyResult = {
  repaired: string[];
  failed: Array<{ rowId: string; error: string }>;
};

/**
 * Applique le plan. N'écrit QUE `accountId` + `updatedAt` : le mot de passe
 * n'est jamais lu ni modifié. Chaque mise à jour est isolée (try/catch).
 */
export async function applyCredentialAccountRepairs(
  store: CredentialAccountStore,
  plan: RepairPlan,
): Promise<ApplyResult> {
  const repaired: string[] = [];
  const failed: Array<{ rowId: string; error: string }> = [];

  for (const decision of plan.toRepair) {
    if (!decision.targetAccountId) continue;
    try {
      await store.account.update({
        where: { id: decision.rowId },
        data: {
          accountId: decision.targetAccountId,
          updatedAt: new Date(),
        },
      });
      repaired.push(decision.rowId);
    } catch (error: unknown) {
      failed.push({
        rowId: decision.rowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { repaired, failed };
}

export type CliOptions = {
  apply: boolean;
  yes: boolean;
};

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { apply: false, yes: false };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/fix-credential-accounts.ts [--apply [--yes]]",
      );
      process.exit(0);
    } else {
      throw new Error(`Option inconnue : ${arg}`);
    }
  }
  return options;
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

function describeDecision(decision: RepairDecision): string {
  const who = decision.userEmail ?? decision.userId;
  switch (decision.action) {
    case "repair":
      return `RÉPARER   ${who} : accountId ${JSON.stringify(decision.currentAccountId)} -> ${JSON.stringify(decision.targetAccountId)}`;
    case "skip-no-password":
      return `IGNORER   ${who} : ${decision.reason}`;
    case "skip-conflict":
      return `CONFLIT   ${who} : ${decision.reason}`;
  }
}

function printPlan(plan: RepairPlan, apply: boolean): void {
  console.log(
    `\n=== ${apply ? "Application" : "Simulation"} — réparation des comptes credential ===`,
  );
  console.log(
    `À réparer : ${plan.toRepair.length} · ignorés : ${plan.skipped.length}`,
  );

  for (const decision of plan.decisions) {
    console.log(`  ${describeDecision(decision)}`);
  }

  if (plan.decisions.length === 0) {
    console.log("  (aucun compte désaligné)");
  }
}

async function confirmInteractive(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      "Refus : --apply sans --yes nécessite un terminal interactif. " +
        "Relancez avec --apply --yes après vérification du dry-run.",
    );
    return false;
  }
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(
      'Taper "REPARER" (en majuscules) pour confirmer l\'écriture : ',
    );
    return answer.trim() === "REPARER";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const rows = await fetchCredentialAccounts(prisma);
    const plan = planCredentialAccountRepairs(rows);
    printPlan(plan, options.apply);

    if (!options.apply) {
      console.log(
        "\nMode dry-run : AUCUNE écriture. Ajoutez --apply --yes pour réparer.",
      );
      return;
    }

    if (!options.yes) {
      const confirmed = await confirmInteractive();
      if (!confirmed) {
        console.error("Confirmation absente : aucune écriture effectuée.");
        process.exitCode = 2;
        return;
      }
    }

    // Relecture juste avant écriture : on ne répare pas un plan périmé.
    const freshRows = await fetchCredentialAccounts(prisma);
    const freshPlan = planCredentialAccountRepairs(freshRows);
    if (freshPlan.toRepair.length === 0) {
      console.log("\nAucune réparation à appliquer (données déjà alignées).");
      return;
    }

    console.log(
      `\nÉcriture de ${freshPlan.toRepair.length} réalignement(s)...`,
    );
    const result = await applyCredentialAccountRepairs(
      prisma as unknown as CredentialAccountStore,
      freshPlan,
    );

    console.log(`Réparés : ${result.repaired.length}`);
    for (const rowId of result.repaired) {
      console.log(`  ✅ ${rowId}`);
    }
    if (result.failed.length > 0) {
      console.error(`Échecs : ${result.failed.length}`);
      for (const failure of result.failed) {
        console.error(`  ❌ ${failure.rowId} : ${failure.error}`);
      }
      process.exitCode = 1;
    } else {
      console.log(
        "\nTerminé. Re-lancez le diagnostic puis testez une connexion e-mail + mot de passe.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Garde d'exécution : ne lance rien quand le module est importé par les tests.
if (!process.env.VITEST) {
  main().catch((error: unknown) => {
    console.error(
      "[fix-credential-accounts] Échec :",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
