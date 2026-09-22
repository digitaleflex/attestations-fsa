// app/api/admin/submissions/[id]/scans/[scanId]/route.ts
// Sert un scan de composition en streaming, protégé admin.
// La lecture passe par l'abstraction de stockage `lib/storage` : le serveur
// récupère l'objet puis le re-sert lui-même (proxy). On n'expose jamais
// d'URL d'objet au client — les scans sont des preuves légales, ils doivent
// rester derrière le contrôle d'accès admin et conserver les en-têtes de
// sécurité (`Content-Disposition: inline`, `Cache-Control`, `nosniff`).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { getStorage } from '@/lib/storage'
import { contentTypeForScanKey, resolveScanObjectKey } from '../scan-storage'

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

    const key = resolveScanObjectKey(id, scan)
    if (!key) {
      return NextResponse.json({ error: 'Scan non trouvé' }, { status: 404 })
    }

    const storage = getStorage()

    // Objet absent côté stockage alors que la ligne existe → 404, pas 500.
    let signedUrl: string
    try {
      if (!(await storage.exists(key))) {
        return NextResponse.json(
          { error: 'Fichier scan introuvable' },
          { status: 404 }
        )
      }
      signedUrl = await storage.getSignedUrl(key)
    } catch (error) {
      console.error('Erreur accès stockage scan:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la lecture du scan' },
        { status: 500 }
      )
    }

    // Récupération serveur-à-serveur : l'URL signée n'est jamais renvoyée au
    // client, l'objet ne sort pas du contrôle d'accès.
    let upstream: Response
    try {
      upstream = await fetch(new URL(signedUrl, request.url))
    } catch (error) {
      console.error('Erreur récupération scan:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la lecture du scan' },
        { status: 500 }
      )
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: 'Fichier scan introuvable' },
        { status: 404 }
      )
    }

    const safeDownloadName = scan.fileName.replace(/["\\\r\n]/g, '_')

    const headers: Record<string, string> = {
      // Type de confiance (déduit de la clé), jamais renvoyé par le stockage.
      'Content-Type': contentTypeForScanKey(key),
      'Content-Disposition': `inline; filename="${safeDownloadName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    }
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      headers['Content-Length'] = contentLength
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    })
  } catch (error: unknown) {
    console.error('Erreur lecture scan:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la lecture du scan' },
      { status: 500 }
    )
  }
}
