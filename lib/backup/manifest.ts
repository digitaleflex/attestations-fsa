/**
 * Manifeste de sauvegarde (#255).
 *
 * Le manifeste est la preuve qu'une sauvegarde existe ET qu'elle est complète :
 * pour chaque artefactil sauvegardé (dump de base, archive de volume), il note
 * le NOM seul (jamais de chemin absolu, jamais d'hôte), la taille en octets et
 * l'empreinte SHA-256, plus la couverture (base + volumes).
 *
 * Module PUR : le script `scripts/backup-manifest.ts` fournit les octets, ce
 * module ne fait que calculer, trier, empreinter et vérifier. Aucun secret,
 * aucune URL signée, aucun chemin hôte ne doit y figurer.
 */
import { canonicalJson, digestOf } from "./canonical";

export const BACKUP_MANIFEST_SCHEMA_VERSION = 1 as const;

export type BackupEntryKind = "database" | "volume";

export interface BackupManifestEntry {
  kind: BackupEntryKind;
  /** Nom de fichier relatif au répertoire de sauvegarde. */
  name: string;
  bytes: number;
  sha256: string;
}

export interface BackupManifest {
  schemaVersion: typeof BACKUP_MANIFEST_SCHEMA_VERSION;
  backupId: string;
  createdAt: string;
  /** `createdAt` est la seule donnée non déterministe : hors empreinte. */
  digest: string;
  coverage: { database: boolean; volumes: string[] };
  entries: BackupManifestEntry[];
  totalBytes: number;
}

export class BackupManifestError extends Error {}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const SAFE_NAME = /^[A-Za-z0-9._-]{1,160}$/;
const ABSOLUTE_PATH = /[\\/:]/;
const SECRET_MARKERS = [/X-Amz-/i, /Signature=/i, /\btoken=/i, /password/i, /secret/i, /:\/\//];

function assertEntry(entry: BackupManifestEntry): void {
  if (entry.kind !== "database" && entry.kind !== "volume") {
    throw new BackupManifestError(`Type d'entrée inconnu: ${String(entry.kind)}`);
  }
  if (!SAFE_NAME.test(entry.name)) {
    throw new BackupManifestError(`Nom d'entrée non sûr (chemin absolu ou caractère interdit): ${entry.name}`);
  }
  if (ABSOLUTE_PATH.test(entry.name)) {
    throw new BackupManifestError(`Chemin absolu interdit dans un manifeste: ${entry.name}`);
  }
  if (!SHA256_HEX.test(entry.sha256)) {
    throw new BackupManifestError(`Empreinte SHA-256 absente ou non conforme pour ${entry.name}`);
  }
  if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
    throw new BackupManifestError(`Taille invalide pour ${entry.name}`);
  }
}

const VOLUME_NAME = /^uploads-([a-z0-9]+)-.*\.tar\.gz$/;

/** Étiquette de volume déduite du nom d'archive (`uploads-public-…tar.gz`). */
export function volumeLabel(name: string): string | null {
  return VOLUME_NAME.exec(name)?.[1] ?? null;
}

export function buildBackupManifest(input: {
  backupId: string;
  createdAt: string;
  entries: BackupManifestEntry[];
}): BackupManifest {
  if (!input.backupId.trim()) throw new BackupManifestError("backupId manquant");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new BackupManifestError("createdAt invalide");
  if (input.entries.length === 0) throw new BackupManifestError("Sauvegarde vide : aucun artefactil à décrire");

  const seen = new Set<string>();
  for (const entry of input.entries) {
    assertEntry(entry);
    if (seen.has(entry.name)) throw new BackupManifestError(`Entrée dupliquée dans le manifeste: ${entry.name}`);
    seen.add(entry.name);
  }

  const entries = [...input.entries].sort((a, b) => a.name.localeCompare(b.name));
  const body = {
    schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
    backupId: input.backupId,
    createdAt: input.createdAt,
    coverage: {
      database: entries.some((entry) => entry.kind === "database"),
      volumes: [...new Set(entries.map((entry) => volumeLabel(entry.name)).filter((v): v is string => v !== null))].sort(),
    },
    entries,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
  return { ...body, digest: digestOf(body) };
}

/** Relit un manifeste depuis le disque et en vérifie la structure ET l'empreinte. */
export function parseBackupManifest(raw: unknown): BackupManifest {
  if (!raw || typeof raw !== "object") throw new BackupManifestError("Manifeste illisible");
  const manifest = raw as Partial<BackupManifest>;
  if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
    throw new BackupManifestError(`Version de manifeste non prise en charge: ${String(manifest.schemaVersion)}`);
  }
  if (typeof manifest.backupId !== "string" || typeof manifest.createdAt !== "string") {
    throw new BackupManifestError("Manifeste incomplet (backupId/createdAt)");
  }
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new BackupManifestError("Manifeste sans entrée");
  }
  const rebuilt = buildBackupManifest({
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    entries: manifest.entries as BackupManifestEntry[],
  });
  if (typeof manifest.digest !== "string" || manifest.digest !== rebuilt.digest) {
    throw new BackupManifestError("Empreinte du manifeste incohérente : le fichier a été altéré");
  }
  // Les champs DÉRIVÉS (couverture, volume total) sont vérifiés eux aussi :
  // sinon une retouche du fichier passerait le contrôle d'empreinte.
  if (canonicalJson(manifest.coverage) !== canonicalJson(rebuilt.coverage)) {
    throw new BackupManifestError("Couverture du manifeste incohérente avec les entrées déclarées");
  }
  if (manifest.totalBytes !== rebuilt.totalBytes) {
    throw new BackupManifestError("Volume total du manifeste incohérent avec les entrées déclarées");
  }
  return rebuilt;
}

export type ManifestFindingCode =
  | "ENTRY_MISSING"
  | "ENTRY_UNDECLARED"
  | "DIGEST_MISMATCH"
  | "SIZE_MISMATCH"
  | "EMPTY_BACKUP"
  | "DATABASE_NOT_COVERED";

export interface ManifestFinding {
  severity: "CRITICAL" | "WARNING";
  check: `MANIFEST.${ManifestFindingCode}`;
  /** Nom de fichier (jamais de chemin absolu). */
  entity: string;
  detail: string;
}

/**
 * Compare le manifeste déclaré aux artefacts réellement présents.
 * Les findings sont triés (par code puis entité) : le rapport est déterministe.
 */
export function verifyBackupManifest(
  manifest: BackupManifest,
  actuals: BackupManifestEntry[],
): ManifestFinding[] {
  const findings: ManifestFinding[] = [];
  const declared = new Map(manifest.entries.map((entry) => [entry.name, entry]));
  const present = new Map(actuals.map((entry) => [entry.name, entry]));

  if (declared.size === 0) {
    findings.push({ severity: "CRITICAL", check: "MANIFEST.EMPTY_BACKUP", entity: "backup", detail: "aucun artefactil déclaré" });
  }
  if (!manifest.coverage.database) {
    findings.push({ severity: "CRITICAL", check: "MANIFEST.DATABASE_NOT_COVERED", entity: "backup", detail: "aucun dump de base dans la sauvegarde" });
  }

  for (const [name, entry] of [...declared.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const actual = present.get(name);
    if (!actual) {
      findings.push({ severity: "CRITICAL", check: "MANIFEST.ENTRY_MISSING", entity: name, detail: "artefactil déclaré absent du répertoire de sauvegarde" });
      continue;
    }
    if (actual.bytes !== entry.bytes) {
      findings.push({ severity: "CRITICAL", check: "MANIFEST.SIZE_MISMATCH", entity: name, detail: `taille ${actual.bytes} o au lieu de ${entry.bytes} o` });
    }
    if (actual.sha256.toLowerCase() !== entry.sha256.toLowerCase()) {
      findings.push({ severity: "CRITICAL", check: "MANIFEST.DIGEST_MISMATCH", entity: name, detail: "empreinte SHA-256 différente : l'artefactil a été modifié après sauvegarde" });
    }
  }

  for (const name of [...present.keys()].sort()) {
    if (!declared.has(name)) {
      findings.push({ severity: "WARNING", check: "MANIFEST.ENTRY_UNDECLARED", entity: name, detail: "artefactil présent mais absent du manifeste" });
    }
  }

  return findings.sort((a, b) => a.check.localeCompare(b.check) || a.entity.localeCompare(b.entity));
}

/** Garde-fou de non-divulgation : aucun secret, URL ou chemin hôte dans le manifeste. */
export function assertManifestIsSafe(manifest: BackupManifest): BackupManifest {
  const serialized = JSON.stringify(manifest);
  for (const marker of SECRET_MARKERS) {
    if (marker.test(serialized)) {
      throw new BackupManifestError(`Contenu potentiellement sensible dans le manifeste (motif: ${marker.source})`);
    }
  }
  for (const entry of manifest.entries) {
    for (const marker of SECRET_MARKERS) {
      if (marker.test(entry.name)) {
        throw new BackupManifestError(`Nom d'entrée potentiellement sensible (motif: ${marker.source})`);
      }
    }
  }
  return manifest;
}
