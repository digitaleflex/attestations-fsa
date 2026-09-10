// lib/api-auth.ts
// Helpers serveur (Node runtime) pour vérifier RÉELLEMENT la session
// dans les routes API. À utiliser dans chaque route sensible :
//
//   import { requireAdmin } from "@/lib/api-auth";
//   export async function GET(request: Request) {
//     const check = await requireAdmin(request);
//     if ("response" in check) return check.response;
//     const { user } = check;
//     ...
//   }
//
// Le middleware Edge (middleware.ts) ne fait qu'un pré-filtre optimiste
// (présence + plausibilité du cookie). La vérification réelle DB
// se fait ici et dans les layouts serveur.

import { NextResponse } from "next/server";
import { getAdminUser, getCurrentUser, type SessionUser } from "@/lib/auth";

export type AdminCheckOk = { user: SessionUser };
export type AdminCheckFail = { response: NextResponse };
export type UserCheckOk = {
  user:
    | SessionUser
    | { id: string; email: string; name: string | null; role: string };
};
export type UserCheckFail = { response: NextResponse };

function unauthorized(message = "Non autorisé") {
  return NextResponse.json({ message, code: "UNAUTHORIZED" }, { status: 401 });
}

function forbidden(message = "Accès interdit — rôle admin requis") {
  return NextResponse.json({ message, code: "FORBIDDEN" }, { status: 403 });
}

/**
 * Vérifie réellement la session et le rôle admin en base.
 * Retourne { user } si OK, sinon { response } (401) à retourner directement.
 */
export async function requireAdmin(
  request: Request,
): Promise<AdminCheckOk | AdminCheckFail> {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return { response: unauthorized() };
    }
    return { user: adminUser };
  } catch (error) {
    console.error("[API AUTH] requireAdmin error:", error);
    return { response: unauthorized("Session invalide") };
  }
}

/**
 * Vérifie réellement la session utilisateur (tout rôle authentifié).
 * Retourne { user } si OK, sinon { response } (401).
 */
export async function requireUser(
  request: Request,
): Promise<UserCheckOk | UserCheckFail> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return { response: unauthorized() };
    }
    return { user };
  } catch (error) {
    console.error("[API AUTH] requireUser error:", error);
    return { response: unauthorized("Session invalide") };
  }
}

/**
 * Vérifie la session puis le rôle admin explicitement (défense en profondeur).
 * Utile quand on a déjà l'utilisateur mais qu'on veut re-vérifier le rôle.
 */
export function assertAdminRole(
  user: { role?: unknown } | null | undefined,
): NextResponse | null {
  const role =
    typeof user?.role === "string" ? user.role.toLowerCase() : undefined;
  if (role !== "admin") {
    return forbidden();
  }
  return null;
}
