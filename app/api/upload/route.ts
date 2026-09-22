import { NextRequest, NextResponse } from "next/server";
import { getAdminUser, getCurrentUser } from "@/lib/auth";
import { buildObjectKey, getStorage, validateUpload } from "@/lib/storage";
import { StorageConfigError } from "@/lib/storage/types";

// Route d'upload générique (CV de demande de stage, images).
// Le stockage est délégué à `lib/storage` : objet S3/R2/MinIO en production,
// fichiers locaux en développement. Aucune écriture dans `public/uploads`
// en production (garde appliquée par la factory).

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = await getCurrentUser(request);
    const admin = await getAdminUser(request);
    if (!user && !admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const validation = validateUpload(
      { size: file.size, type: file.type, name: file.name },
      bytes
    );
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const storage = getStorage();
    const key = buildObjectKey(validation.mime);
    await storage.put(key, bytes, validation.mime);
    const url = await storage.getSignedUrl(key);

    return NextResponse.json(
      {
        url,
        key,
        filename: file.name,
        size: file.size,
        type: validation.mime,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof StorageConfigError) {
      console.error("[UPLOAD_STORAGE_CONFIG_ERROR]", error.message);
      return NextResponse.json(
        { error: "Stockage des fichiers mal configuré" },
        { status: 500 }
      );
    }
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const admin = await getAdminUser(request);
    if (!user && !admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Paramètre key requis" }, { status: 400 });
    }

    const storage = getStorage();
    try {
      await storage.delete(key);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Clé de stockage invalide")) {
        return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ deleted: true, key });
  } catch (error) {
    if (error instanceof StorageConfigError) {
      console.error("[UPLOAD_STORAGE_CONFIG_ERROR]", error.message);
      return NextResponse.json(
        { error: "Stockage des fichiers mal configuré" },
        { status: 500 }
      );
    }
    console.error("[UPLOAD_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
