/**
 * Procédure de restauration testable localement (#255).
 *
 * La restauration d'un backup de production est la seule opération la plus
 * risquée du projet : elle écrase une base. Ce module ne l'exécute PAS — il
 * produit un PLAN, refusant par défaut toute cible qui n'est pas une base
 * isolée locale. La procédure réelle (pg_restore) reste une commande humaine,
 * copiée depuis `plan.commands` et exécutée manuellement.
 *
 * Module PUR : aucun accès base, aucun secret, aucune écriture.
 */
import { canonicalJson, digestOf } from "./canonical";
import {
  verifyBackupManifest,
  type BackupManifest,
  type BackupManifestEntry,
  type ManifestFinding,
} from "./manifest";

/** Hôtes considérés comme isolés (localhost, services Docker de test). */
export const ALLOWED_RESTORE_HOSTS = [
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres-e2e",
  "postgres",
  "db",
] as const;

/** Une base de restauration isolée DOIT s'appeler `fsa_restore_*`. */
export const ISOLATED_DATABASE_PATTERN = /^fsa_restore_[a-z0-9_]{1,40}$/;

export const RESTORE_PRODUCTION_REFUSAL_MESSAGE =
  "Refusé : cible de restauration non isolée. Une restauration ne peut viser qu'une base locale " +
  "nommant fsa_restore_* (jamais la production). Aucune commande n'a été produite.";

export class RestoreRefusedError extends Error {}

export interface RestoreTarget {
  host: string;
  database: string;
  port?: number;
  /** Nom d'utilisateur local — jamais de mot de passe (hors variable d'environnement). */
  user?: string;
}

export interface RestorePlan {
  /** Version du plan — un plan plus ancien n'est pas rejouable tel quel. */
  schemaVersion: 1;
  backupId: string;
  manifestDigest: string;
  createdAt: string;
  target: RestoreTarget;
  /** Vérifications effectuées AVANT toute commande. */
  verification: {
    manifestEntries: number;
    totalBytes: number;
    findings: ManifestFinding[];
    exportDigest: string | null;
    exportDigestExpected: string | null;
  };
  /** Commandes à exécuter manuellement, dans l'ordre. Aucune n'est exécutée ici. */
  commands: string[];
  /** Contrôles à passer après restauration, sur la base cible. */
  postRestoreChecks: string[];
  /** Toujours vrai : ce module n'écrit rien. */
  executed: false;
}

export interface RestorePlanInput {
  manifest: BackupManifest;
  target: RestoreTarget;
  /** Artefacts réellement présents dans le répertoire de sauvegarde. */
  actuals: BackupManifestEntry[];
  /** Empreinte de l'export de référence, relue avant restauration. */
  actualExportDigest?: string | null;
  /** Empreinte attendue (celle relevée avant la sauvegarde). */
  expectedExportDigest?: string | null;
}

function assertIsolatedTarget(target: RestoreTarget): void {
  if (!ALLOWED_RESTORE_HOSTS.includes(target.host as (typeof ALLOWED_RESTORE_HOSTS)[number])) {
    throw new RestoreRefusedError(
      `${RESTORE_PRODUCTION_REFUSAL_MESSAGE} (hôte: ${target.host})`,
    );
  }
  if (!ISOLATED_DATABASE_PATTERN.test(target.database)) {
    throw new RestoreRefusedError(
      `${RESTORE_PRODUCTION_REFUSAL_MESSAGE} (base: ${target.database})`,
    );
  }
  if (target.user && /[:@/]/.test(target.user)) {
    throw new RestoreRefusedError("Identifiant de restauration suspect : il ne doit contenir ni mot de passe ni hôte.");
  }
}

/**
 * Produit le plan de restauration, ou REFUSE si la cible n'est pas isolée ou si
 * la sauvegarde ne correspond pas à son manifeste.
 */
export function planRestore(input: RestorePlanInput): RestorePlan {
  assertIsolatedTarget(input.target);

  const findings = verifyBackupManifest(input.manifest, input.actuals);
  const critical = findings.filter((finding) => finding.severity === "CRITICAL");
  if (critical.length > 0) {
    throw new RestoreRefusedError(
      `Refusé : ${critical.length} anomalie(s) critique(s) de sauvegarde — restauration impossible. ` +
        `Première anomalie: ${critical[0].check} sur ${critical[0].entity}.`,
    );
  }

  const host = input.target.host;
  const database = input.target.database;
  const dump = input.manifest.entries.find((entry) => entry.kind === "database");
  if (!dump) throw new RestoreRefusedError("Refusé : aucun dump de base déclaré dans le manifeste.");
  const user = input.target.user ? ` -U ${input.target.user}` : "";
  const port = input.target.port ? ` -p ${input.target.port}` : "";

  const commands = [
    `# 0. Créer la base isolée (jamais la production)`,
    `createdb${port}${user} -h ${host} ${database}`,
    `# 1. Restaurer le dump déclaré dans le manifeste (${dump.name}, ${dump.bytes} o)`,
    `pg_restore${port}${user} -h ${host} -d ${database} --clean --if-exists --no-owner ./${dump.name}`,
  ];
  for (const volume of input.manifest.coverage.volumes) {
    commands.push(
      `# 2. Volume « ${volume} » : extraire l'archive PUIS comparer au manifeste avant tout remplacement`,
      `sha256sum ./$(ls -1 uploads-${volume}-*.tar.gz | head -1)`,
    );
  }
  commands.push(
    "# 3. Vérifier l'intégrité applicative AVANT de publier (read-only)",
    `pnpm exec ts-node --project tsconfig.seed.json scripts/check-data-integrity.ts --dry-run --report reports/fsa-reference-restore.json`,
    "# 4. Rapprocher l'export de référence (aucune écriture)",
    `pnpm exec ts-node --project tsconfig.seed.json scripts/export-reference.ts --out reports/fsa-reference-restore.json`,
  );

  const postRestoreChecks = [
    `sha256sum du dump = ${dump.sha256}`,
    "compte d'attestations identique au manifeste de référence",
    "aucun code FSA modifié : comparer l'export de référence (empreinte ci-dessous)",
    "trigger d'immuabilité du code présent : la restauration le réinstalle (pg_restore inclut le schéma)",
  ];

  return {
    schemaVersion: 1,
    backupId: input.manifest.backupId,
    manifestDigest: input.manifest.digest,
    createdAt: input.manifest.createdAt,
    target: input.target,
    verification: {
      manifestEntries: input.manifest.entries.length,
      totalBytes: input.manifest.totalBytes,
      findings,
      exportDigest: input.actualExportDigest ?? null,
      exportDigestExpected: input.expectedExportDigest ?? null,
    },
    commands,
    postRestoreChecks,
    executed: false,
  };
}

/** Empreinte d'un export de référence — sert de contrôle post-restauration. */
export function exportDigestOf(exported: unknown): string {
  return digestOf(exported);
}

/** Sérialisation canonique d'un plan, pour comparaison entre deux exécutions. */
export function serializeRestorePlan(plan: RestorePlan): string {
  return `${canonicalJson(plan)}\n`;
}
