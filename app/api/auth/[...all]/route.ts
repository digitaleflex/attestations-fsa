// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

/**
 * Gestionnaire des routes Better Auth pour Next.js (App Router)
 * Traite automatiquement toutes les routes sous /api/auth/*
 */
export const { GET, POST } = toNextJsHandler(auth.handler)
