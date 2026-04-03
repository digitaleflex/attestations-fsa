# 🛠️ Guide de Correction des Vulnérabilités de Sécurité

**Application :** Attestations FSA  
**Version :** 0.1.0  
**Public Cible :** Développeurs Full-Stack  
**Prérequis :** Next.js 15, TypeScript, Prisma, Better Auth  
**Temps Estimé :** 28.5 jours (P0 + P1 + P2)

---

## 📑 Table des Matières

1. [Installation des Dépendances de Sécurité](#1-installation-des-dépendances-de-sécurité)
2. [P0 - Corrections Critiques (48h)](#2-p0---corrections-critiques-48h)
3. [P1 - Corrections Élevées (Semaine 1)](#3-p1---corrections-élevées-semaine-1)
4. [P2 - Améliorations (Semaine 2-3)](#4-p2---améliorations-semaine-2-3)
5. [Checklist de Validation](#5-checklist-de-validation)
6. [Tests de Sécurité](#6-tests-de-sécurité)

---

## 1. Installation des Dépendances de Sécurité

### 1.1 Dépendances à Ajouter

```bash
# Rate limiting
pnpm add @upstash/ratelimit @upstash/redis

# Sanitization
pnpm add dompurify

# Validation environment variables
pnpm add envalid

# Utility pour CSRF
pnpm add csrf

# Pour tests de sécurité
pnpm add -D @types/dompurify
```

### 1.2 Fichier `.env` à Mettre à Jour

```bash
# .env.example (à copier vers .env.local)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/attestations_fsa"

# Better Auth
AUTH_SECRET="votre-secret-tres-long-et-aleatoire-min-32-caracteres"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"

# App URL
NEXT_PUBLIC_APP_URL="https://votre-domaine.com"

# Email (Resend)
RESEND_API_KEY="re_xxx"

# Security
NODE_ENV="production"
```

---

## 2. P0 - Corrections Critiques (48h)

### 2.1 Étape 1 : Unifier l'Authentification

**Fichier :** `app/api/auth/login/route.ts`

**Action :** Supprimer ce fichier et migrer vers Better Auth

```typescript
// ❌ À SUPPRIMER - Ce fichier crée la dualité d'auth
// app/api/auth/login/route.ts
```

**Remplacement :** Utiliser uniquement `/api/auth/[...all]/route.ts`

**Migration des cookies custom vers Better Auth :**

```typescript
// lib/auth.ts - Modifier la configuration
const authConfig: BetterAuthOptions = {
  secret: process.env.AUTH_SECRET!,
  database: { adapter },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,  // ✅ Renforcé (était 8)
    maxPasswordLength: 128,
    requireEmailVerification: true,  // ✅ Ajouté
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 jours
    updateAge: 60 * 60 * 24,  // 1 jour (session rolling)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5  // 5 minutes
    }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "USER"
      }
    }
  },
  plugins: [
    nextCookies()  // ✅ Gère automatiquement les cookies sécurisés
  ],
  advanced: {
    // ✅ Protection CSRF intégrée
    csrf: {
      enabled: true,
      cookieName: 'csrf_token',
    }
  }
}
```

---

### 2.2 Étape 2 : Créer le Middleware Next.js

**Fichier :** `middleware.ts` (à créer à la racine)

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes protégées par rôle
const ADMIN_ROUTES = ['/admin', '/api/admin']
const USER_ROUTES = ['/dashboard', '/api/user']
const PUBLIC_ROUTES = ['/api/public', '/api/verifier', '/api/signalement']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // ============================================
  // 1. HEADERS DE SÉCURITÉ (US-SEC-03)
  // ============================================
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  
  // HSTS uniquement en production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://upstash.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // ============================================
  // 2. PROTECTION CSRF (US-SEC-01)
  // ============================================
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    // Skip pour les routes publiques
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
    
    if (!isPublicRoute) {
      const csrfToken = request.cookies.get('csrf_token')?.value
      const headerToken = request.headers.get('x-csrf-token')
      
      if (!csrfToken || !headerToken || csrfToken !== headerToken) {
        return new NextResponse(
          JSON.stringify({ error: 'Token CSRF invalide ou manquant' }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }
  }

  // ============================================
  // 3. VÉRIFICATION AUTHENTIFICATION
  // ============================================
  const sessionCookie = request.cookies.get('better-auth.session_token')
  const roleCookie = request.cookies.get('better-auth.session_data')
  
  // Routes admin
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (!sessionCookie) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Non autorisé - Authentification requise' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Vérifier rôle admin
    try {
      const sessionData = JSON.parse(decodeURIComponent(roleCookie?.value || '{}'))
      if (sessionData.user?.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Accès refusé - Rights admin requis' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Routes utilisateur
  if (USER_ROUTES.some(route => pathname.startsWith(route))) {
    if (!sessionCookie) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Non autorisé - Authentification requise' },
          { status: 401 }
        )
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // ============================================
  // 4. RATE LIMITING (US-SEC-02) - Via headers
  // ============================================
  response.headers.set('X-RateLimit-Limit', '100')
  response.headers.set('X-RateLimit-Remaining', '99')

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, sitemap.xml, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

### 2.3 Étape 3 : Implémenter Rate Limiting

**Fichier :** `lib/rate-limit.ts` (à créer)

```typescript
// lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Initialisation Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limits par endpoint
export const rateLimits = {
  // Authentification - Très restrictif
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),  // 5 essais / 15min
    analytics: true,
    prefix: "ratelimit:login",
  }),

  // Inscription
  register: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 inscriptions / heure
    analytics: true,
    prefix: "ratelimit:register",
  }),

  // Signalement
  report: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 h"),  // 3 signalements / heure
    analytics: true,
    prefix: "ratelimit:report",
  }),

  // Vérification code
  verify: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),  // 10 vérifications / heure
    analytics: true,
    prefix: "ratelimit:verify",
  }),

  // API générale
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),  // 100 req / minute
    analytics: true,
    prefix: "ratelimit:api",
  }),

  // Soumission examen
  submission: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),  // 5 submissions / heure
    analytics: true,
    prefix: "ratelimit:submission",
  }),
}

// Helper pour appliquer le rate limiting
export async function applyRateLimit(
  request: NextRequest,
  limitType: keyof typeof rateLimits
) {
  const ip = request.ip || 'unknown'
  const limit = rateLimits[limitType]
  
  const { success, limit: max, reset, remaining } = await limit.limit(ip)

  if (!success) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Trop de requêtes. Veuillez réessayer plus tard.',
          retryAfter: new Date(reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': max.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': new Date(reset).toISOString(),
          },
        }
      ),
    }
  }

  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString(),
    },
  }
}
```

**Utilisation dans les routes API :**

```typescript
// Exemple: app/api/auth/login/route.ts (si conservé)
import { NextRequest } from 'next/server'
import { applyRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Appliquer rate limiting
  const rateLimit = await applyRateLimit(request, 'login')
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // ... reste du code
}
```

---

### 2.4 Étape 4 : Sécuriser les Cookies

**Fichier :** `lib/auth.ts` (modification)

```typescript
// lib/auth.ts - Ajouter configuration cookies sécurisés
const authConfig: BetterAuthOptions = {
  // ... configuration existante
  
  advanced: {
    // Configuration des cookies
    cookiePrefix: 'better-auth',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',  // ✅ HTTPS uniquement
      sameSite: 'lax',  // ✅ Protection CSRF
      path: '/',
      httpOnly: true,  // ✅ Non accessible via JS
    },
  },
  
  // ... suite configuration
}
```

---

### 2.5 Étape 5 : Générer Token CSRF

**Fichier :** `lib/csrf.ts` (à créer)

```typescript
// lib/csrf.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

// Générer un token CSRF
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

// Valider un token CSRF
export function validateCSRFToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token)
}

// Middleware helper pour ajouter token CSRF
export async function addCSRFTokenToResponse(response: NextResponse) {
  const token = generateCSRFToken()
  
  response.cookies.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24,  // 1 jour
  })
  
  return response
}

// Hook pour récupérer token CSRF côté client
export async function getCSRFToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get('csrf_token')?.value
}
```

**Utilisation côté client :**

```typescript
// components/forms/secure-form.tsx
'use client'

import { useEffect, useState } from 'react'

export function SecureForm() {
  const [csrfToken, setCsrfToken] = useState('')

  useEffect(() => {
    // Récupérer token depuis cookie (via API si httpOnly)
    fetch('/api/csrf-token').then(r => r.json()).then(d => {
      setCsrfToken(d.token)
    })
  }, [])

  const handleSubmit = async (data: any) => {
    await fetch('/api/endpoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,  // ✅ Token dans header
      },
      body: JSON.stringify(data),
    })
  }

  return (
    // ... formulaire
  )
}
```

---

## 3. P1 - Corrections Élevées (Semaine 1)

### 3.1 Validation Upload de Fichiers

**Fichier :** `app/api/admin/submissions/[id]/scans/route.ts`

**Remplacer par :**

```typescript
// app/api/admin/submissions/[id]/scans/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Types MIME autorisés
const ALLOWED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const

const MAX_FILE_SIZE = 5 * 1024 * 1024  // 5MB

// Vérifier magic bytes
function getFileType(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 4))
  const signature = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()
  
  if (signature.startsWith('25 50 44 46')) return 'application/pdf'  // %PDF
  if (signature.startsWith('FF D8 FF')) return 'image/jpeg'  // JPEG
  if (signature.startsWith('89 50 4E 47')) return 'image/png'  // PNG
  
  return null
}

async function isAuthenticatedAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  const role = cookieStore.get('user_role')
  if (!session?.value || role?.value !== 'ADMIN') return null
  return session.value
}

// POST - Upload sécurisé
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminId = await isAuthenticatedAdmin()
    if (!adminId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const formData = await request.formData()
    const files = formData.getAll('scans') as File[]

    if (files.length === 0) {
      return NextResponse.json({ message: 'Aucun fichier fourni' }, { status: 400 })
    }

    const scans = []
    const uploadDir = join(process.cwd(), 'private', 'uploads', 'scans', id)

    // Créer dossier si n'existe pas
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // ✅ Validation taille
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({
          error: `Fichier trop volumieux: ${file.name}. Maximum 5MB autorisé.`
        }, { status: 400 })
      }

      // ✅ Validation type MIME
      if (!ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES]) {
        return NextResponse.json({
          error: `Type de fichier non autorisé: ${file.type}. Seuls PDF, JPG et PNG sont acceptés.`
        }, { status: 400 })
      }

      // ✅ Vérification magic bytes
      const arrayBuffer = await file.arrayBuffer()
      const detectedType = getFileType(arrayBuffer)
      
      if (!detectedType || detectedType !== file.type) {
        return NextResponse.json({
          error: `Fichier suspect détecté: ${file.name}. Le type réel ne correspond pas à l'extension.`
        }, { status: 400 })
      }

      // ✅ Renommage sécurisé avec UUID
      const fileExtension = ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES]
      const safeFileName = `${randomBytes(16).toString('hex')}${fileExtension}`
      const filePath = join(uploadDir, safeFileName)

      // ✅ Sauvegarde hors webroot
      await writeFile(filePath, Buffer.from(arrayBuffer))

      // Création entrée BDD
      const scan = await prisma.compositionScan.create({
        data: {
          submissionId: id,
          url: `/secure-files/scans/${id}/${safeFileName}`,  // Route protégée
          pageNumber: i + 1,
          fileName: file.name,  // Nom original pour affichage
          fileSize: file.size,
          mimeType: file.type,
          uploadedBy: adminId,
        }
      })

      scans.push(scan)
    }

    return NextResponse.json({
      message: 'Scans uploadés avec succès',
      scans
    })

  } catch (error: any) {
    console.error('Erreur upload scans:', error)
    return NextResponse.json({
      error: 'Erreur lors de l\'upload des scans'
    }, { status: 500 })
  }
}
```

---

### 3.2 Password Reset Flow

**Fichier :** `app/api/user/password-reset/request/route.ts` (à créer)

```typescript
// app/api/user/password-reset/request/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { z } from 'zod'

const RequestSchema = z.object({
  email: z.string().email('Email invalide'),
})

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = RequestSchema.safeParse(body)
    
    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Entrée invalide', 
        details: parse.error.errors 
      }, { status: 400 })
    }

    const { email } = parse.data

    // Chercher utilisateur (sans révéler s'il existe)
    const user = await prisma.user.findUnique({ where: { email } })
    
    // Toujours répondre OK pour ne pas révéler l'existence du compte
    if (!user) {
      return NextResponse.json({ 
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' 
      })
    }

    // Générer token unique
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)  // 1 heure

    // Stocker token (réutiliser table Verification ou créer PasswordResetToken)
    await prisma.verification.create({
      data: {
        identifier: `password_reset:${user.id}`,
        value: token,
        expiresAt,
      }
    })

    // Envoyer email
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`
    
    await resend.emails.send({
      from: 'Ferme St André <noreply@votre-domaine.com>',
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <h1>Réinitialisation de mot de passe</h1>
        <p>Bonjour ${user.name || 'Utilisateur'},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous (valable 1 heure) :</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        <p>Ce lien ne peut être utilisé qu'une seule fois.</p>
      `,
    })

    return NextResponse.json({ 
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' 
    })

  } catch (error: any) {
    console.error('Password reset error:', error)
    return NextResponse.json({ 
      message: 'Erreur lors de la demande de réinitialisation' 
    }, { status: 500 })
  }
}
```

**Fichier :** `app/api/user/password-reset/confirm/route.ts` (à créer)

```typescript
// app/api/user/password-reset/confirm/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const ConfirmSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  email: z.string().email('Email invalide'),
  newPassword: z.string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Doit contenir au moins un caractère spécial'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parse = ConfirmSchema.safeParse(body)
    
    if (!parse.success) {
      return NextResponse.json({ 
        message: 'Entrée invalide', 
        details: parse.error.errors 
      }, { status: 400 })
    }

    const { token, email, newPassword } = parse.data

    // Trouver utilisateur
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ 
        message: 'Token invalide ou expiré' 
      }, { status: 400 })
    }

    // Vérifier token
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: `password_reset:${user.id}`,
        value: token,
        expiresAt: { gt: new Date() },
      }
    })

    if (!verification) {
      return NextResponse.json({ 
        message: 'Token invalide ou expiré' 
      }, { status: 400 })
    }

    // Hasher nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Mettre à jour mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    // Supprimer token (usage unique)
    await prisma.verification.delete({ where: { id: verification.id } })

    // Invalider toutes les sessions existantes
    await prisma.session.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ 
      message: 'Mot de passe réinitialisé avec succès. Veuillez vous reconnecter.' 
    })

  } catch (error: any) {
    console.error('Password reset confirm error:', error)
    return NextResponse.json({ 
      message: 'Erreur lors de la réinitialisation' 
    }, { status: 500 })
  }
}
```

---

### 3.3 Email Verification

**Fichier :** `app/api/user/send-verification/route.ts` (à créer)

```typescript
// app/api/user/send-verification/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { getAuth } from '@/lib/auth'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const auth = await getAuth()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ 
        message: 'Email déjà vérifié' 
      }, { status: 400 })
    }

    // Générer token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 heures

    // Supprimer ancien token si existe
    await prisma.verification.deleteMany({
      where: { identifier: `email_verify:${user.id}` }
    })

    // Stocker token
    await prisma.verification.create({
      data: {
        identifier: `email_verify:${user.id}`,
        value: token,
        expiresAt,
      }
    })

    // Envoyer email
    const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/user/verify-email?token=${token}`
    
    await resend.emails.send({
      from: 'Ferme St André <noreply@votre-domaine.com>',
      to: user.email!,
      subject: 'Vérifiez votre adresse email',
      html: `
        <h1>Vérification d'email</h1>
        <p>Bonjour ${user.name || 'Utilisateur'},</p>
        <p>Cliquez sur le lien ci-dessous pour vérifier votre email :</p>
        <a href="${verifyLink}">${verifyLink}</a>
        <p>Ce lien est valable 24 heures.</p>
      `,
    })

    return NextResponse.json({ 
      message: 'Email de vérification envoyé' 
    })

  } catch (error: any) {
    console.error('Send verification error:', error)
    return NextResponse.json({ 
      message: 'Erreur lors de l\'envoi de l\'email' 
    }, { status: 500 })
  }
}
```

**Fichier :** `app/api/user/verify-email/route.ts` (à créer)

```typescript
// app/api/user/verify-email/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/verification-error?reason=missing-token', request.url))
    }

    // Trouver token
    const verification = await prisma.verification.findFirst({
      where: {
        identifier: { startsWith: 'email_verify:' },
        value: token,
        expiresAt: { gt: new Date() },
      }
    })

    if (!verification) {
      return NextResponse.redirect(new URL('/verification-error?reason=invalid-token', request.url))
    }

    // Extraire userId
    const userId = verification.identifier.split(':')[1]

    // Vérifier utilisateur
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.redirect(new URL('/verification-error?reason=user-not-found', request.url))
    }

    // Marquer email comme vérifié
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() }
    })

    // Supprimer token
    await prisma.verification.delete({ where: { id: verification.id } })

    // Rediriger vers page succès
    return NextResponse.redirect(new URL('/verification-success', request.url))

  } catch (error: any) {
    console.error('Verify email error:', error)
    return NextResponse.redirect(new URL('/verification-error?reason=server-error', request.url))
  }
}
```

---

### 3.4 Protection IDOR Systématique

**Fichier :** `lib/authorization.ts` (à créer)

```typescript
// lib/authorization.ts
import { prisma } from '@/lib/prisma'

// Vérifier ownership d'une ressource
export async function checkOwnership<T extends { userId: string | null }>(
  resource: T | null,
  userId: string,
  resourceType: string
): Promise<boolean> {
  if (!resource) {
    return false
  }

  // Admin a accès à tout
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.role === 'ADMIN') {
    return true
  }

  // Vérifier ownership
  if (resource.userId !== userId) {
    console.warn(`Tentative d'accès non autorisé à ${resourceType}: ${resource.id}`)
    return false
  }

  return true
}

// Helper pour les routes API
export function createOwnershipChecker(model: any, userId: string, isAdmin: boolean) {
  return async (resourceId: string) => {
    const resource = await model.findUnique({
      where: { id: resourceId },
      select: { userId: true }
    })

    if (!resource) {
      return { found: false, authorized: false }
    }

    if (isAdmin) {
      return { found: true, authorized: true }
    }

    if (resource.userId !== userId) {
      return { found: true, authorized: false }
    }

    return { found: true, authorized: true }
  }
}
```

**Exemple d'utilisation :**

```typescript
// app/api/submissions/[id]/route.ts
import { checkOwnership } from '@/lib/authorization'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await isAuthenticatedUser()
  const { id } = await params

  const submission = await prisma.examSubmission.findUnique({
    where: { id },
    include: { user: true }
  })

  // ✅ Vérification IDOR
  const isOwner = await checkOwnership(submission, userId!, 'submission')
  
  if (!isOwner) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  return NextResponse.json(submission)
}
```

---

### 3.5 Sanitization des Entrées

**Fichier :** `lib/sanitization.ts` (à créer)

```typescript
// lib/sanitization.ts
import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

// Initialiser DOMPurify pour environnement Node.js
const window = new JSDOM('').window
const purify = DOMPurify(window)

// Configuration de sanitization
const sanitizeOptions = {
  ALLOWED_TAGS: [],  // Aucun tag HTML autorisé
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,  // Garder le texte seulement
}

// Sanitiser une chaîne
export function sanitizeInput(input: string): string {
  if (!input) return ''
  return purify.sanitize(input, sanitizeOptions)
}

// Sanitiser un objet
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

// Champs critiques à sanitiser
export const CRITICAL_FIELDS = [
  'message',
  'reason',
  'fullName',
  'observations',
  'comments',
] as const

// Middleware de sanitization pour Zod
export function createSanitizedSchema<T extends z.ZodType>(schema: T) {
  return schema.transform((data) => {
    if (typeof data === 'string') {
      return sanitizeInput(data) as any
    }
    return data
  })
}
```

**Utilisation dans les routes :**

```typescript
// app/api/signalement/route.ts
import { sanitizeInput } from '@/lib/sanitization'

export async function POST(req: Request) {
  const body = await req.json()
  
  // ✅ Sanitiser avant validation
  const sanitizedBody = {
    ...body,
    motif: sanitizeInput(body.motif),
    message: sanitizeInput(body.message),
  }
  
  const parse = SignalementSchema.safeParse(sanitizedBody)
  // ...
}
```

---

### 3.6 Gestion des Erreurs

**Fichier :** `lib/error-handler.ts` (à créer)

```typescript
// lib/error-handler.ts
import { NextResponse } from 'next/server'

interface ApiError {
  message: string
  code?: string
  details?: any
}

export function handleApiError(error: unknown, context?: {
  route?: string
  userId?: string
  operation?: string
}) {
  // Logger l'erreur complète (côté serveur uniquement)
  console.error('[API ERROR]', {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  })

  // Message générique pour le client
  const publicMessage = 'Une erreur est survenue. Veuillez réessayer plus tard.'

  // En développement, afficher plus de détails
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({
      message: error instanceof Error ? error.message : publicMessage,
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }

  // En production, message générique uniquement
  return NextResponse.json({
    message: publicMessage,
  }, { status: 500 })
}

// Types d'erreurs connues
export const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
} as const

export function createError(
  type: keyof typeof ErrorTypes,
  message: string,
  details?: any
): ApiError {
  return {
    message,
    code: ErrorTypes[type],
    details,
  }
}
```

**Utilisation :**

```typescript
// Dans toutes les routes API
export async function POST(request: Request) {
  try {
    // ... logique métier
  } catch (error) {
    return handleApiError(error, {
      route: request.url,
      operation: 'create_resource',
    })
  }
}
```

---

## 4. P2 - Améliorations (Semaine 2-3)

### 4.1 Security Logger

**Fichier :** `lib/security-logger.ts` (à créer)

```typescript
// lib/security-logger.ts
import { prisma } from '@/lib/prisma'

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_CONFIRM'
  | 'EMAIL_VERIFICATION'
  | 'ACCESS_DENIED'
  | 'RESOURCE_CREATE'
  | 'RESOURCE_UPDATE'
  | 'RESOURCE_DELETE'
  | 'FILE_UPLOAD'
  | 'DATA_EXPORT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_VIOLATION'
  | 'SUSPICIOUS_ACTIVITY'

export interface SecurityEvent {
  eventType: SecurityEventType
  userId?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  resourceId?: string
  action?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  status: 'SUCCESS' | 'FAILURE'
  details?: Record<string, unknown>
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export async function logSecurityEvent(event: SecurityEvent) {
  const severity = event.severity || getEventSeverity(event.eventType)

  // Logger en console (ou envoyer vers SIEM)
  console.log(`[SECURITY] ${event.eventType}`, {
    userId: event.userId,
    ipAddress: event.ipAddress,
    resource: event.resource,
    status: event.status,
    severity,
  })

  // Stocker en base de données (optionnel - selon volumétrie)
  try {
    await prisma.securityLog.create({
      data: {
        eventType: event.eventType,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resource: event.resource,
        resourceId: event.resourceId,
        action: event.action,
        status: event.status,
        severity,
        details: event.details,
        timestamp: new Date(),
      }
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

function getEventSeverity(eventType: SecurityEventType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const severityMap: Record<SecurityEventType, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    LOGIN_SUCCESS: 'LOW',
    LOGIN_FAILURE: 'MEDIUM',
    LOGOUT: 'LOW',
    PASSWORD_CHANGE: 'HIGH',
    PASSWORD_RESET_REQUEST: 'HIGH',
    PASSWORD_RESET_CONFIRM: 'CRITICAL',
    EMAIL_VERIFICATION: 'MEDIUM',
    ACCESS_DENIED: 'MEDIUM',
    RESOURCE_CREATE: 'MEDIUM',
    RESOURCE_UPDATE: 'MEDIUM',
    RESOURCE_DELETE: 'HIGH',
    FILE_UPLOAD: 'MEDIUM',
    DATA_EXPORT: 'HIGH',
    RATE_LIMIT_EXCEEDED: 'MEDIUM',
    CSRF_VIOLATION: 'CRITICAL',
    SUSPICIOUS_ACTIVITY: 'HIGH',
  }

  return severityMap[eventType] || 'LOW'
}
```

**Ajouter au schema Prisma :**

```prisma
// prisma/schema.prisma
model SecurityLog {
  id        String   @id @default(uuid())
  eventType String
  userId    String?
  ipAddress String?
  userAgent String?
  resource  String?
  resourceId String?
  action    String?
  status    String
  severity  String
  details   Json?
  timestamp DateTime @default(now())

  @@index([eventType])
  @@index([userId])
  @@index([timestamp])
  @@index([severity])
}
```

---

### 4.2 Audit Trail

Similaire au security logger mais focalisé sur les actions métier.

**Fichier :** `lib/audit-logger.ts` (à créer)

```typescript
// lib/audit-logger.ts
import { prisma } from '@/lib/prisma'

export interface AuditLog {
  userId: string
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  resource: string
  resourceId: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  timestamp?: Date
}

export async function logAuditEvent(log: AuditLog) {
  await prisma.auditLog.create({
    data: {
      userId: log.userId,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp || new Date(),
    }
  })
}

// Helper pour comparer objets
export function getChangedFields(oldObj: any, newObj: any): Record<string, { old: any, new: any }> {
  const changes: Record<string, { old: any, new: any }> = {}
  
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})])
  
  for (const key of allKeys) {
    if (JSON.stringify(oldObj?.[key]) !== JSON.stringify(newObj?.[key])) {
      changes[key] = {
        old: oldObj?.[key],
        new: newObj?.[key],
      }
    }
  }
  
  return changes
}
```

---

## 5. Checklist de Validation

### P0 - Critique

- [ ] Dual auth supprimé (Better Auth uniquement)
- [ ] Middleware créé avec headers sécurité
- [ ] Cookies httpOnly + secure + sameSite
- [ ] Rate limiting implémenté
- [ ] CSRF tokens fonctionnels
- [ ] Tests de pénétration basiques passés

### P1 - Élevé

- [ ] Upload fichiers validé (type, taille, magic bytes)
- [ ] Password reset flow complet
- [ ] Email verification fonctionnelle
- [ ] Protection IDOR sur toutes routes
- [ ] Sanitization entrées (DOMPurify)
- [ ] Gestion erreurs sécurisée

### P2 - Moyen

- [ ] Security logger opérationnel
- [ ] Audit trail implémenté
- [ ] Chiffrement données sensibles
- [ ] Backup strategy documentée
- [ ] MFA/2FA disponible

---

## 6. Tests de Sécurité

### 6.1 Tests Automatisés

**Fichier :** `tests/security/auth.test.ts`

```typescript
// tests/security/auth.test.ts
import request from 'supertest'

describe('Authentication Security', () => {
  const app = 'http://localhost:3000'

  it('should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrong' })
    
    expect(response.status).toBe(401)
    expect(response.body.message).not.toContain('stack')
  })

  it('should set secure cookies', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'correct' })
    
    const cookies = response.headers['set-cookie']
    expect(cookies).toBeDefined()
    
    // Vérifier flags de sécurité
    const sessionCookie = cookies.find((c: string) => c.includes('session'))
    expect(sessionCookie).toContain('HttpOnly')
    expect(sessionCookie).toContain('Secure')
    expect(sessionCookie).toContain('SameSite')
  })

  it('should enforce rate limiting', async () => {
    // 6 requêtes en 15 minutes devrait échouer
    for (let i = 0; i < 6; i++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrong' })
      
      if (i >= 5) {
        expect(response.status).toBe(429)
      }
    }
  })
})
```

### 6.2 Checklist Tests Manuels

- [ ] Tester XSS sur tous les formulaires
- [ ] Tester CSRF avec site externe
- [ ] Tester IDOR en changeant IDs dans URLs
- [ ] Tester upload avec fichiers malveillants
- [ ] Tester rate limiting avec scripts
- [ ] Tester SQL injection (même si Prisma)
- [ ] Tester fuite d'information via erreurs

---

## 📞 Support

En cas de question ou difficulté lors de l'implémentation :

1. Consulter la documentation Better Auth : https://www.better-auth.com/
2. Vérifier les issues GitHub du projet
3. Contacter l'équipe sécurité

---

**Document établi par :** Expert Cybersécurité  
**Date :** 1 Avril 2026  
**Version :** 1.0

*Bon courage dans la sécurisation de l'application ! 🔒*
