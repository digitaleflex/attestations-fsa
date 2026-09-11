// app/api/admin/submissions/[id]/scans/[scanId]/route.ts
// Sert un scan de composition en streaming, protégé admin.
// Le chemin physique est dérivé de l'id du scan et confiné au dossier
// d'upload de la soumission (protection contre la traversée de chemin).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { basename, extname, join, resolve, sep } from 'path'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { getAdminUser } from '@/lib/auth'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

/**
 * Résout le chemin physique d'un scan en le confinant au dossier d'upload
 * de sa soumission. Gère les anciens scans dont l'URL `/secure-files/...`
 * contenait le nom de fichier.
 */
function resolveScanFilePath(
  submissionId: string,
  scan: { id: string; url: string; fileName: string }
): string | null {
  let storedName: string
  if (scan.url.startsWith('/secure-files/scans/')) {
    storedName = basename(scan.url)
  } else {
    const ext = '.' + (scan.fileName.split('.').pop() || '').toLowerCase()
    storedName = `${scan.id}${MIME_BY_EXTENSION[ext] ? ext : '.pdf'}`
  }

  if (
    !storedName ||
    storedName === '.' ||
    storedName === '..' ||
    storedName.includes('/') ||
    storedName.includes('\\')
  ) {
    return null
  }

  const uploadDir = resolve(
    join(process.cwd(), 'private', 'uploads', 'scans', submissionId)
  )
  const filePath = resolve(uploadDir, storedName)

  // Empêche toute traversée de chemin hors du dossier de la soumission.
  if (!filePath.startsWith(uploadDir + sep)) {
    return null
  }

  return filePath
}

// GET /api/admin/submissions/[id]/scans/[scanId] - Servir un scan
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; scanId: string }> }
) {
  try {
    const adminUser = await getAdminUser(request)
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      )
    }

    const { id, scanId } = await params

    // Le scan doit appartenir à la soumission demandée.
    const scan = await prisma.compositionScan.findFirst({
      where: { id: scanId, submissionId: id },
    })

    if (!scan) {
      return NextResponse.json({ error: 'Scan non trouvé' }, { status: 404 })
    }

    const filePath = resolveScanFilePath(id, scan)
    if (!filePath) {
      return NextResponse.json({ error: 'Scan non trouvé' }, { status: 404 })
    }

    let fileStats
    try {
      fileStats = await stat(filePath)
    } catch {
      return NextResponse.json(
        { error: 'Fichier scan introuvable sur le disque' },
        { status: 404 }
      )
    }

    if (!fileStats.isFile()) {
      return NextResponse.json({ error: 'Scan non trouvé' }, { status: 404 })
    }

    const contentType =
      MIME_BY_EXTENSION[extname(filePath).toLowerCase()] ||
      'application/octet-stream'

    const stream = Readable.toWeb(
      createReadStream(filePath)
    ) as unknown as ReadableStream<Uint8Array>

    const safeDownloadName = scan.fileName.replace(/["\\\r\n]/g, '_')

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStats.size),
        'Content-Disposition': `inline; filename="${safeDownloadName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    console.error('Erreur lecture scan:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du scan' },
      { status: 500 }
    )
  }
}
