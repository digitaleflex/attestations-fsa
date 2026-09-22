// lib/storage/migrate.ts
// Migration des fichiers existants du filesystem local vers le stockage objet.
//
// Usage :
//   npx tsx lib/storage/migrate.ts --dry-run
//   npx tsx lib/storage/migrate.ts
//   npx tsx lib/storage/migrate.ts --dir private/uploads --delete-local
//
// Le script recopie chaque fichier en conservant son chemin relatif comme clé
// logique, ce qui permet de retrouver l'objet à partir de l'ancienne URL
// (`/uploads/<clé>`). Il ne modifie PAS la base de données : les références
// restent à mettre à jour côté métier (cf. docs/storage.md).

import { readdir, readFile, stat, unlink } from "fs/promises";
import { join, relative, resolve, sep } from "path";
import { createStorage } from "./index";
import { detectMimeType } from "./validation";

interface Options {
  dir: string;
  dryRun: boolean;
  deleteLocal: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dir: join(process.cwd(), "public", "uploads"),
    dryRun: false,
    deleteLocal: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--delete-local") options.deleteLocal = true;
    else if (arg === "--dir") {
      const value = argv[i + 1];
      if (!value) throw new Error("--dir requiert un chemin");
      options.dir = resolve(value);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx lib/storage/migrate.ts [--dir <path>] [--dry-run] [--delete-local]"
      );
      process.exit(0);
    } else {
      throw new Error(`Argument inconnu: ${arg}`);
    }
  }
  return options;
}

/** Liste récursivement les fichiers d'un répertoire (chemins absolus). */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const rootStat = await stat(options.dir).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    console.error(`Répertoire introuvable: ${options.dir}`);
    process.exitCode = 1;
    return;
  }

  const storage = createStorage();
  const files = await walk(options.dir);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const key = relative(options.dir, filePath).split(sep).join("/");
    const buffer = await readFile(filePath);
    const mime = detectMimeType(buffer);
    if (!mime) {
      console.warn(`[SKIP] type non reconnu: ${key}`);
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(`[DRY-RUN] ${key} (${buffer.length} octets, ${mime})`);
      migrated += 1;
      continue;
    }

    try {
      await storage.put(key, buffer, mime);
      if (options.deleteLocal) await unlink(filePath);
      console.log(`[OK] ${key}`);
      migrated += 1;
    } catch (error) {
      console.error(`[ERREUR] ${key}:`, error);
      failed += 1;
    }
  }

  console.log(
    `Migration terminée — migrés: ${migrated}, ignorés: ${skipped}, échecs: ${failed}` +
      (options.dryRun ? " (dry-run : aucune écriture)" : "")
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Migration interrompue:", error);
  process.exitCode = 1;
});
