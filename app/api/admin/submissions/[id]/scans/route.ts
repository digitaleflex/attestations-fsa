// app/api/admin/submissions/[id]/scans/route.ts
// Route sécurisée pour l'upload de scans d'examens
// Protection : authentification Better Auth, validation type/taille, magic bytes
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { handleApiError, ApiErrorImpl } from '@/lib/error-handler'
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth'

// ============================================================================
// CONFIGURATION DE SÉCURITÉ
// ============================================================================

// Types MIME autorisés (strict whitelist)
const ALLOWED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const

const ALLOWED_EXTENSIONS = Object.values(ALLOWED_MIME_TYPES)
const MAX_FILE_SIZE = 5 * 1024 * 1024  // 5MB
const MAX_FILES_PER_UPLOAD = 10  // Limite le nombre de fichiers par upload

// Magic bytes signatures pour validation
const MAGIC_BYTES: Record<string, string[]> = {
  'application/pdf': ['25 50 44 46'],  // %PDF
  'image/jpeg': ['FF D8 FF'],  // JPEG
  'image/png': ['89 50 4E 47'],  // PNG
}

// ============================================================================
// HELPERS DE VALIDATION
// ============================================================================

/**
 * Vérifie le type MIME d'un fichier via ses magic bytes
 * @param buffer - Contenu binaire du fichier
 * @returns Type MIME détecté ou null
 */
function detectFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 4))
  const signature = Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')

  for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
    if (signatures.some(sig => signature.startsWith(sig))) {
      return mimeType
    }
  }

  return null
}

/**
 * Valide l'extension d'un fichier
 * @param filename - Nom du fichier
 * @returns true si l'extension est autorisée
 */
function isValidExtension(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext as any)
}

/**
 * Génère un nom de fichier sécurisé
 * @param originalName - Nom original du fichier
 * @returns Nom de fichier UUIDisé
 */
function generateSafeFilename(originalName: string): string {
  const ext = '.' + originalName.split('.').pop()?.toLowerCase() || '.pdf'
  return `${randomBytes(16).toString('hex')}${ext}`
}

// ============================================================================
// GET - Récupérer les scans
// ============================================================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Authentification unifiée avec Better Auth
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      )
    }

    const adminUser = await getCurrentUser()
    const { id } = await params

    // ✅ Utilise examSession (nouveau nom du modèle)
    const session = await prisma.examSession.findUnique({
      where: { id },
      include: {
        scans: {
          orderBy: { pageNumber: 'asc' }
        }
      }
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Soumission non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ scans: session.scans })

  } catch (error: any) {
    console.error('Erreur récupération scans:', error)
    return handleApiError(error, {
      route: '/api/admin/submissions/[id]/scans',
      operation: 'get_scans',
    })
  }
}

// ============================================================================
// POST - Upload sécurisé de scans
// ============================================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Authentification unifiée avec Better Auth
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      )
    }

    const adminUser = await getCurrentUser()
    const adminId = (adminUser as { id?: string })?.id

    const { id } = await params

    // ✅ Vérifier que la session existe (nouveau nom du modèle)
    const session = await prisma.examSession.findUnique({
      where: { id }
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Soumission non trouvée' },
        { status: 404 }
      )
    }

    // Récupérer les fichiers
    const formData = await request.formData()
    const files = formData.getAll('scans') as File[]

    if (files.length === 0) {
      throw new ApiErrorImpl('VALIDATION', 'Aucun fichier fourni')
    }

    // ✅ Limite le nombre de fichiers
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw new ApiErrorImpl(
        'VALIDATION',
        `Trop de fichiers. Maximum ${MAX_FILES_PER_UPLOAD} fichiers autorisés.`
      )
    }

    const scans = []
    const uploadDir = join(process.cwd(), 'private', 'uploads', 'scans', id)

    // Créer le dossier d'upload s'il n'existe pas (hors webroot)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // ✅ Validation de la taille
      if (file.size > MAX_FILE_SIZE) {
        throw new ApiErrorImpl(
          'VALIDATION',
          `Fichier trop volumieux: ${file.name}. Maximum 5MB autorisé.`
        )
      }

      // ✅ Validation du type MIME
      if (!ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES]) {
        throw new ApiErrorImpl(
          'VALIDATION',
          `Type de fichier non autorisé: ${file.type}. Seuls PDF, JPG et PNG sont acceptés.`
        )
      }

      // ✅ Validation de l'extension
      if (!isValidExtension(file.name)) {
        throw new ApiErrorImpl(
          'VALIDATION',
          `Extension non autorisée: ${file.name}. Extensions acceptées: .pdf, .jpg, .png`
        )
      }

      // ✅ Vérification des magic bytes (contenu réel du fichier)
      const arrayBuffer = await file.arrayBuffer()
      const detectedType = detectFileType(arrayBuffer)

      if (!detectedType) {
        throw new ApiErrorImpl(
          'VALIDATION',
          `Fichier suspect détecté: ${file.name}. Impossible de vérifier le type de fichier.`
        )
      }

      if (detectedType !== file.type) {
        throw new ApiErrorImpl(
          'VALIDATION',
          `Fichier suspect: ${file.name}. Le type réel (${detectedType}) ne correspond pas au type déclaré (${file.type}).`
        )
      }

      // ✅ Génération d'un nom de fichier sécurisé (UUID)
      const safeFileName = generateSafeFilename(file.name)
      const filePath = join(uploadDir, safeFileName)

      // ✅ Sauvegarde hors webroot (dossier private)
      await writeFile(filePath, Buffer.from(arrayBuffer))

      // Création de l'entrée en base de données
      const scan = await prisma.compositionScan.create({
        data: {
          submissionId: id,
          url: `/secure-files/scans/${id}/${safeFileName}`,  // Route protégée à implémenter
          pageNumber: i + 1,
          fileName: file.name,  // Nom original pour affichage
          fileSize: file.size,
          uploadedBy: adminId || 'unknown',
        }
      })

      scans.push(scan)
    }

    return NextResponse.json({
      message: `${scans.length} scan(s) uploadé(s) avec succès`,
      scans,
      count: scans.length
    })

  } catch (error: any) {
    console.error('Erreur upload scans:', error)
    return handleApiError(error, {
      route: '/api/admin/submissions/[id]/scans',
      operation: 'upload_scans',
    })
  }
}

// ============================================================================
// DELETE - Supprimer un scan
// ✅ FIX: scanId est passé en query parameter (?scanId=xxx) au lieu de route param
// ============================================================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Authentification unifiée avec Better Auth
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { error: 'Non autorisé - Authentification admin requise' },
        { status: 401 }
      )
    }

    const { id } = await params

    // ✅ Récupérer scanId depuis les query parameters
    const { searchParams } = new URL(request.url)
    const scanId = searchParams.get('scanId')

    if (!scanId) {
      return NextResponse.json(
        { error: 'Paramètre scanId requis (ex: ?scanId=xxx)' },
        { status: 400 }
      )
    }

    // Vérifier que le scan existe et appartient à la session
    const scan = await prisma.compositionScan.findUnique({
      where: {
        id: scanId,
        submissionId: id
      }
    })

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan non trouvé' },
        { status: 404 }
      )
    }

    // Supprimer le fichier physique (optionnel - selon votre stockage)
    // const filePath = join(process.cwd(), 'private', 'uploads', 'scans', id, scan.fileName)
    // try {
    //   await unlink(filePath)
    // } catch (err) {
    //   console.warn('Impossible de supprimer le fichier physique:', err)
    // }

    // Supprimer l'entrée BDD
    await prisma.compositionScan.delete({
      where: { id: scanId }
    })

    return NextResponse.json({
      message: 'Scan supprimé avec succès',
      deletedScanId: scanId
    })

  } catch (error: any) {
    console.error('Erreur suppression scan:', error)
    return handleApiError(error, {
      route: '/api/admin/submissions/[id]/scans',
      operation: 'delete_scan',
    })
  }
}
