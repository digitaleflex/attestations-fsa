// app/api/_middleware.ts
// Compatibilité Task 5 : point d'entrée historique du middleware API.
//
// En App Router, le middleware Edge global est `middleware.ts` à la racine.
// La vérification RÉELLE de session (DB) ne peut pas se faire sur l'Edge
// (pas de Prisma) : elle se fait côté serveur via `@/lib/api-auth`.
// Ce fichier ré-exporte donc les helpers serveur pour les routes API.
//
// Usage dans une route :
//   import { requireAdmin } from "@/app/api/_middleware";
//   const check = await requireAdmin(request);
//   if ("response" in check) return check.response;

export { requireAdmin, requireUser, assertAdminRole } from "@/lib/api-auth";
export type {
  AdminCheckOk,
  AdminCheckFail,
  UserCheckOk,
  UserCheckFail,
} from "@/lib/api-auth";
