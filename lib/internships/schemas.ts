/**
 * #267 — Validation des entrées admin « demandes de stage ».
 *
 * Le statut n'est plus une chaîne libre : il est validé contre l'enum
 * `InternshipStatus` (cf. `lib/internships/state-machine.ts`). La pagination est
 * validée elle aussi (bornes explicites) pour qu'une liste ou un export ne
 * puisse pas être demandé « sans limite » par un paramètre truqué.
 */

import { z } from "zod";

import { INTERNSHIP_STATUSES } from "./state-machine";

/** Liste admin : taille de page par défaut et maximum. */
export const INTERNSHIPS_PAGE_SIZE_DEFAULT = 20;
export const INTERNSHIPS_PAGE_SIZE_MAX = 100;

/** Export : le fichier peut être plus large que la liste à l'écran. */
export const INTERNSHIPS_EXPORT_PAGE_SIZE_DEFAULT = 50;
export const INTERNSHIPS_EXPORT_PAGE_SIZE_MAX = 500;

export const internshipStatusSchema = z.enum(INTERNSHIP_STATUSES, {
  errorMap: () => ({ message: "Statut de demande de stage invalide" }),
});

/** `?status=` : absent, vide ou `ALL` = pas de filtre ; sinon valeur de l'enum. */
const statusFilterSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "" || value === "ALL") {
      return null;
    }
    const parsed = internshipStatusSchema.safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Filtre de statut invalide : ${value}`,
      });
      return z.NEVER;
    }
    return parsed.data;
  });

/**
 * `?page=&pageSize=` : entiers ≥ 1, `pageSize` borné. Une page au-delà du
 * dernier page renvoie simplement une liste vide (comportement attendu quand la
 * liste rétrécit entre deux rafraîchissements), pas une erreur.
 */
const pagedQueryShape = (defaultPageSize: number, maxPageSize: number) => ({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .default(defaultPageSize)
    // Borne haute de sécurité : une valeur numérique mais abusive est ramenée
    // au maximum autorisé au lieu d'être rejetée.
    .transform((value) => Math.min(value, maxPageSize)),
  status: statusFilterSchema,
});

/** Liste admin : `?page=&pageSize=&status=`. */
export const internshipListQuerySchema = z.object(
  pagedQueryShape(INTERNSHIPS_PAGE_SIZE_DEFAULT, INTERNSHIPS_PAGE_SIZE_MAX),
);

/** Export : mêmes paramètres, bornes de taille plus larges. */
export const internshipExportQuerySchema = z.object(
  pagedQueryShape(INTERNSHIPS_EXPORT_PAGE_SIZE_DEFAULT, INTERNSHIPS_EXPORT_PAGE_SIZE_MAX),
);

/** Corps du PATCH de statut : `{ id, status }`. */
export const internshipStatusPatchSchema = z.object({
  id: z.string().min(1, "Identifiant de demande requis"),
  status: internshipStatusSchema,
});

export type InternshipListQuery = z.infer<typeof internshipListQuerySchema>;
export type InternshipExportQuery = z.infer<typeof internshipExportQuerySchema>;
export type InternshipPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Construit le bloc `pagination` renvoyé à l'UI. */
export function buildPagination(
  query: { page: number; pageSize: number },
  total: number,
): InternshipPagination {
  const pageSize = Math.max(1, query.pageSize);
  return {
    page: query.page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
