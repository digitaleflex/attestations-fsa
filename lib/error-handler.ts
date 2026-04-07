// lib/error-handler.ts
// Gestion centralisée et sécurisée des erreurs API
// Masque les détails sensibles en production
import { NextResponse } from "next/server";

interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

interface ErrorContext {
  route?: string;
  userId?: string;
  operation?: string;
  ip?: string;
}

/**
 * Types d'erreurs connues avec codes HTTP associés
 */
export const ErrorTypes = {
  VALIDATION: { code: "VALIDATION_ERROR", status: 400 },
  NOT_FOUND: { code: "NOT_FOUND", status: 404 },
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401 },
  FORBIDDEN: { code: "FORBIDDEN", status: 403 },
  CONFLICT: { code: "CONFLICT", status: 409 },
  RATE_LIMIT: { code: "RATE_LIMIT_EXCEEDED", status: 429 },
  CSRF: { code: "CSRF_VALIDATION_FAILED", status: 403 },
  SERVER: { code: "INTERNAL_SERVER_ERROR", status: 500 },
} as const;

/**
 * Crée un objet d'erreur standardisé
 */
export function createError(
  type: keyof typeof ErrorTypes,
  message: string,
  details?: unknown,
): ApiError {
  return {
    message,
    code: ErrorTypes[type].code,
    details,
  };
}

/**
 * Message d'erreur générique pour le public
 */
const PUBLIC_ERROR_MESSAGE =
  "Une erreur est survenue. Veuillez réessayer plus tard.";

/**
 * Gère les erreurs de manière sécurisée
 * - Log les détails complets côté serveur
 * - Masque les informations sensibles en production
 * - Retourne un format d'erreur cohérent
 */
export function handleApiError(
  error: unknown,
  context?: ErrorContext,
): NextResponse {
  // Logger l'erreur complète (côté serveur uniquement) pour le debugging
  const errorDetails = {
    timestamp: new Date().toISOString(),
    route: context?.route,
    operation: context?.operation,
    userId: context?.userId,
    ip: context?.ip,
    error: {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
    },
  };

  console.error("[API ERROR SEV-1]", JSON.stringify(errorDetails, null, 2));

  // 1. Erreurs métier connues (Toujours sécurisées à renvoyer)
  if (error instanceof ApiErrorImpl) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status },
    );
  }

  // 2. Gestion spécifique à l'environnement
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : PUBLIC_ERROR_MESSAGE,
        code: "INTERNAL_SERVER_ERROR_DEV",
        details: error instanceof Error ? error.stack : undefined,
        context,
      },
      { status: 500 },
    );
  }

  // 3. Fallback Production (Générique pour sécurité)
  return NextResponse.json(
    {
      error: PUBLIC_ERROR_MESSAGE,
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 },
  );
}

/**
 * Classe d'erreur API personnalisée
 * Permet de lever des erreurs métier avec statut HTTP
 */
export class ApiErrorImpl extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    type: keyof typeof ErrorTypes,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = ErrorTypes[type].code;
    this.status = ErrorTypes[type].status;
    this.details = details;
  }
}

/**
 * Formatte une erreur de validation Zod
 */
export function formatValidationError(error: unknown): ApiError {
  if (error && typeof error === "object" && "errors" in error) {
    const zodError = error as {
      errors: Array<{ path: string[] | undefined; message: string }>;
    };
    return {
      message: "Validation échouée",
      code: "VALIDATION_ERROR",
      details: zodError.errors.map((e) => ({
        field: e.path?.join(".") || "unknown",
        message: e.message,
      })),
    };
  }

  return {
    message: "Entrée invalide",
    code: "VALIDATION_ERROR",
  };
}
