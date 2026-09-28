// lib/stage-attestation/validation.ts
// Validation stricte du corps de génération d'une attestation de stage.
// #266 — scores, dates et champs texte ne doivent jamais pouvoir être arbitraires.
//
// Règle transverse : on ne FABRIQUE aucune donnée. Toute valeur absente reste
// `null` ; toute valeur qui ne peut pas venir d'une source réelle (identité,
// réglage d'établissement) fait échouer la requête.

import { z } from "zod";

/** Longueurs maximales des champs texte libres gravés sur le document. */
export const STAGE_LIMITS = {
  location: 120,
  instructor: 120,
  observations: 2000,
  fullName: 160,
  position: 160,
  birthPlace: 120,
  issuingCompany: 160,
} as const;

/** Fenêtre de dates admises pour un stage (évite 0001-01-01 et 9999-12-31). */
const MIN_STAGE_YEAR = 2000;
const MAX_STAGE_YEAR = 2100;

/** Date ISO-8601 : `AAAA-MM-JJ` ou date-heure avec suffixe `Z`/offset. */
const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Chaîne ISO valide : format correct ET date réelle.
 * `new Date("2026-02-31")` ne renvoie pas NaN en V8 (décalage silencieux au
 * 3 mars) : on revérifie donc explicitement le triplet année/mois/jour pour les
 * dates sans heure. Les dates-heure sont seulement bornées en année.
 */
const isoDate = z
  .string({ required_error: "Champ requis", invalid_type_error: "Date invalide" })
  .trim()
  .regex(ISO_DATE_RE, "Format de date invalide (ISO 8601 attendu, ex. 2026-01-15)")
  .refine((value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    const year = parsed.getUTCFullYear();
    if (year < MIN_STAGE_YEAR || year > MAX_STAGE_YEAR) return false;
    if (value.length > 10) return true; // date-heure : pas de contrôle calendaire
    const [y, m, d] = value.split("-").map(Number);
    return (
      parsed.getUTCFullYear() === y &&
      parsed.getUTCMonth() + 1 === m &&
      parsed.getUTCDate() === d
    );
  }, `Date hors fenêtre ${MIN_STAGE_YEAR}-${MAX_STAGE_YEAR} ou inexistante`);

/**
 * Score borné 0-100.
 * Accepte un nombre ou une chaîne numérique NON vide ; `""`, `null`, `"abc"`,
 * `NaN`, `Infinity`, les négatifs et les > 100 sont tous refusés.
 */
const boundedScore = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === "string" && value.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Score vide : valeur interdite" });
      return z.NEVER;
    }
    const parsed = typeof value === "number" ? value : Number(value.trim());
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Score non numérique (NaN/Infinity refusés)" });
      return z.NEVER;
    }
    return parsed;
  })
  .refine((value) => value >= 0 && value <= 100, "Le score doit être compris entre 0 et 100");

const optionalText = (max: number, label: string) =>
  z
    .string({ invalid_type_error: `${label} doit être une chaîne` })
    .trim()
    .min(1, `${label} ne peut pas être vide`)
    .max(max, `${label} : ${max} caractères maximum`);

export const stageAttestationInputSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    location: optionalText(STAGE_LIMITS.location, "Le lieu").optional(),
    instructor: optionalText(STAGE_LIMITS.instructor, "Le responsable").optional(),
    stageScore: boundedScore.optional(),
    stageObservations: optionalText(STAGE_LIMITS.observations, "Les observations").optional(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.startDate).getTime() > new Date(value.endDate).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "La date de fin doit être postérieure ou égale à la date de début",
      });
    }
  });

/**
 * Champs d'identité strictement INTERDITS dans le corps de la requête.
 * L'identité (date et lieu de naissance) provient exclusivement du dossier
 * utilisateur : la laisser saisissable reviendrait à laisser le client
 * fabriquer des données personnelles sur un document officiel.
 */
export const FORBIDDEN_IDENTITY_FIELDS = ["birthDate", "birthPlace"] as const;

export const stageAttestationRawSchema = z
  .object({
    birthDate: z.never({ invalid_type_error: "Interdit : fourni par le dossier utilisateur uniquement" }).optional(),
    birthPlace: z.never({ invalid_type_error: "Interdit : fourni par le dossier utilisateur uniquement" }).optional(),
  })
  .passthrough();

export interface StageAttestationInput {
  startDate: string;
  endDate: string;
  location?: string;
  instructor?: string;
  stageScore?: number;
  stageObservations?: string;
}

export interface ValidationSuccess {
  success: true;
  data: StageAttestationInput;
}

export interface ValidationFailure {
  success: false;
  /** Liste lisible des problems Zod, jamais les valeurs rejetées. */
  issues: { path: string; message: string }[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

/** Valide le corps reçu : renvoie un résultat discriminant, ne lève jamais. */
export function validateStageAttestationInput(body: unknown): ValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      success: false,
      issues: [{ path: "", message: "Corps de requête attendu (objet JSON)" }],
    };
  }

  const identityResult = stageAttestationRawSchema.safeParse(body);
  if (!identityResult.success) {
    return {
      success: false,
      issues: identityResult.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const result = stageAttestationInputSchema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  return { success: true, data: result.data };
}
