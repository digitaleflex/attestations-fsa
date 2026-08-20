import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { getAdminUser, getCurrentUser } from "@/lib/auth";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getSubDir(mimeType: string): string {
  if (mimeType === "application/pdf") return "cv";
  if (mimeType.startsWith("image/")) return "images";
  return "misc";
}

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

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo)` },
        { status: 400 }
      );
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "bin";
    const subDir = getSubDir(file.type);
    const filename = `${nanoid(12)}.${ext}`;
    const uploadPath = join(UPLOAD_DIR, subDir);

    // Ensure directory exists
    await mkdir(uploadPath, { recursive: true });

    // Write file
    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadPath, filename), Buffer.from(bytes));

    const publicUrl = `/uploads/${subDir}/${filename}`;

    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    }, { status: 201 });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}
