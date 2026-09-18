// scripts/seal-key-check.ts
// Diagnostic LOCAL, LECTURE SEULE, de la clé de scellement CERT_SEAL_SECRET (#155).
//
// Ce script n'affiche JAMAIS la valeur d'une clé : uniquement sa présence, sa
// longueur et son EMPREINTE non réversible (sha256 tronqué à 12 hex). Il ne
// modifie aucun fichier.
//
// Empreinte = sha256(secret) hexadécimal, tronqué aux 12 premiers caractères.
// Une empreinte identique = même clé. Deux empreintes différentes = divergence
// ou rotation.
//
// Utilisation :
//   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seal-key-check.ts
//   pnpm exec ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seal-key-check.ts --strict
//
// --strict : code de sortie 1 si clé absente / trop courte / rotation
//            (empreinte réelle ≠ CERT_SEAL_FINGERPRINT) / divergence entre
//            environnements.
//
// ── PROCÉDURE DE SAUVEGARDE (à lire) ─────────────────────────────────────────
// 1. CERT_SEAL_SECRET ne se rotationne PAS : elle scelle toutes les attestations.
// 2. Sauvegardez-la dans un gestionnaire de mots de passe (1Password, Bitwarden,
//    Vaultwarden…) AVEC l'empreinte épinglée CERT_SEAL_FINGERPRINT.
// 3. Si vous changez cette clé, les attestations DÉJÀ scellées seront signalées
//    comme falsifiées (« empreinte incohérente : données altérées ») : c'est un
//    faux positif de rotation, pas une altération réelle. Aucun remède
//    rétroactif n'existe sans la clé d'origine.
// 4. L'empreinte (non secrète) est épinglée dans CERT_SEAL_FINGERPRINT et
//    vérifiable à distance via GET /api/ready (checks.sealFingerprint*).
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeSealFingerprint, getSealSecret } from "../lib/crypto/seal";

/** Variables parsées d'un fichier .env (clé → valeur, en mémoire seulement). */
export interface ParsedEnv {
  [key: string]: string;
}

/** Analyse minimaliste d'un fichier .env (aucune dépendance, aucune valeur affichée). */
export function parseDotenv(content: string): ParsedEnv {
  const vars: ParsedEnv = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

export interface EnvSealReport {
  file: string;
  /** La clé existe et atteint la longueur minimale. */
  present: boolean;
  /** Longueur de la clé (jamais sa valeur). */
  length: number | null;
  /** Empreinte non secrète, ou null si clé absente / trop courte. */
  fingerprint: string | null;
  /** Empreinte attendue épinglée dans ce fichier, ou null. */
  expectedFingerprint: string | null;
  /** true / false, ou null si aucune empreinte attendue n'est épinglée. */
  matches: boolean | null;
  /** true si épinglée et différente = rotation détectée. */
  rotation: boolean;
  /** Problème actionnable détecté pour ce fichier, sinon null. */
  problem: string | null;
}

/** Analyse un contenu .env. `content === null` = fichier introuvable. */
export function analyzeEnvFile(file: string, content: string | null): EnvSealReport {
  if (content === null) {
    return {
      file,
      present: false,
      length: null,
      fingerprint: null,
      expectedFingerprint: null,
      matches: null,
      rotation: false,
      problem: `${file} introuvable`,
    };
  }

  const vars = parseDotenv(content);
  const raw = vars.CERT_SEAL_SECRET;
  const expected = (vars.CERT_SEAL_FINGERPRINT ?? "").trim() || null;
  const secret = getSealSecret(raw);
  if (!secret) {
    return {
      file,
      present: false,
      length: raw ? raw.length : null,
      fingerprint: null,
      expectedFingerprint: expected,
      matches: expected ? false : null,
      rotation: false,
      problem: raw
        ? `${file} : CERT_SEAL_SECRET trop court (minimum 16 caractères)`
        : `${file} : CERT_SEAL_SECRET absent`,
    };
  }

  const fingerprint = computeSealFingerprint(secret);
  const matches = expected ? fingerprint === expected : null;
  const rotation = matches === false;
  return {
    file,
    present: true,
    length: secret.length,
    fingerprint,
    expectedFingerprint: expected,
    matches,
    rotation,
    problem: rotation
      ? `${file} : rotation détectée — empreinte réelle ≠ CERT_SEAL_FINGERPRINT`
      : null,
  };
}

/** Détecte les empreintes divergentes entre plusieurs environnements. */
export function findDivergence(reports: EnvSealReport[]): string[] {
  const byFingerprint = new Map<string, string[]>();
  for (const report of reports) {
    if (!report.fingerprint) continue;
    const files = byFingerprint.get(report.fingerprint) ?? [];
    files.push(report.file);
    byFingerprint.set(report.fingerprint, files);
  }
  if (byFingerprint.size <= 1) return [];
  const detail = [...byFingerprint.values()].map((files) => files.join(" + ")).join(" ≠ ");
  return [
    `divergence de clé entre environnements : ${detail} — un certificat scellé ` +
      `dans l'un n'est pas vérifiable dans l'autre`,
  ];
}

const ENV_FILES = [".env.local", ".env.production"] as const;

function readIfPresent(file: string): string | null {
  try {
    return readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return null;
  }
}

function formatReport(report: EnvSealReport): string {
  if (!report.present) {
    const length = report.length === null ? "" : ` (${report.length} caractères)`;
    return `  ${report.file.padEnd(18)} CERT_SEAL_SECRET : absent${length}`;
  }
  const pinned = report.expectedFingerprint
    ? report.matches
      ? "empreinte attendue : OK"
      : "⚠ empreinte attendue ≠ réelle"
    : "non épinglée";
  return (
    `  ${report.file.padEnd(18)} CERT_SEAL_SECRET : présent ` +
    `(${report.length} caractères) — empreinte ${report.fingerprint} [${pinned}]`
  );
}

/** Exécute le diagnostic. Retourne le code de sortie (0 par défaut, 1 en --strict). */
export function main(argv: string[] = process.argv.slice(2)): number {
  const strict = argv.includes("--strict");
  const reports = ENV_FILES.map((file) => analyzeEnvFile(file, readIfPresent(file)));
  const divergences = findDivergence(reports);
  const problems = [
    ...reports.map((r) => r.problem).filter((p): p is string => Boolean(p)),
    ...divergences,
  ];

  console.log("Seal key check (#155) — lecture seule, aucune valeur de clé affichée.");
  console.log(
    "Empreinte = sha256(clé) hexadécimal tronqué à 12 caractères (non réversible).\n",
  );
  for (const report of reports) console.log(formatReport(report));
  console.log("");

  for (const divergence of divergences) console.log(`⚠ ${divergence}`);
  if (divergences.length > 0) console.log("");

  for (const report of reports) {
    if (!report.rotation) continue;
    console.log(
      `⚠ ${report.file} : la clé a changé (empreinte réelle ≠ CERT_SEAL_FINGERPRINT).\n` +
        "  Les certificats DÉJÀ scellés seront signalés comme « empreinte incohérente :\n" +
        "  données altérées » — un faux positif de rotation, pas une falsification.",
    );
  }

  console.log(
    "\nRègle : CERT_SEAL_SECRET ne se rotationne PAS. Sauvegardez-la dans un\n" +
      "gestionnaire de mots de passe avec son empreinte CERT_SEAL_FINGERPRINT.\n" +
      "En cas de perte, les certificats déjà scellés deviennent irrécupérables.",
  );

  if (problems.length === 0) {
    console.log("\nRésultat : OK");
    return 0;
  }
  console.log(`\nRésultat : ${problems.length} problème(s) détecté(s)`);
  return strict ? 1 : 0;
}

const entryPoint = process.argv[1] ? resolve(process.argv[1]) : "";
const isDirectRun =
  entryPoint.endsWith("seal-key-check.ts") || entryPoint.endsWith("seal-key-check.js");

if (isDirectRun) {
  process.exitCode = main();
}
