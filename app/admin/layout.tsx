import * as React from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { auth, isAdminUser } from "@/lib/auth";
import { enforceAccountStatus } from "@/lib/account-status";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { AdminCommandPaletteTrigger } from "@/components/admin/AdminCommandPaletteTrigger";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import NotificationCenter from "@/components/admin/NotificationCenter";

/**
 * Layout Admin optimisé (Server Component)
 * La sécurité (redirection) est gérée par le middleware.ts pour éviter les boucles.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // Récupération de la session (le middleware a optimisé la latence, c'est ici qu'on valide le rôle)
  const session = await auth.api.getSession({
    headers: headerList,
  });

  const isLoginPage =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/");

  // `/admin/2fa/verify` est une page d'authentification à part entière : quand
  // la 2FA est en attente, Better Auth a supprimé le cookie de session et n'a
  // laissé qu'un cookie `two_factor`. Exiger ici une session admin renverrait
  // l'administrateur vers /admin/login en boucle et le verrouillerait hors de
  // son compte. Les endpoints de vérification, eux, exigent le cookie 2FA.
  const isTwoFactorVerifyPage =
    pathname === "/admin/2fa/verify" ||
    pathname.startsWith("/admin/2fa/verify/");

  const isStandaloneAuthPage = isLoginPage || isTwoFactorVerifyPage;

  // Sécurité Stricte (RSC Validation)
  if (!isStandaloneAuthPage) {
    // Si pas connecté ou pas admin -> on bloque et on redirige
    if (!session || !isAdminUser(session.user)) {
      redirect("/admin/login");
    }

    // Défense en profondeur : le layout ne se contente pas du cookie/role lus
    // par `getSession`, il applique la MÊME source de vérité que les routes API
    // (`enforceAccountStatus`). Un compte bloqué/suspendu dont la session
    // aurait survécu (échec de révocation, accès direct) est refusé ici aussi.
    const access = await enforceAccountStatus(session.user.id);
    if (!access.allowed || access.user?.resetPasswordRequired) {
      redirect("/admin/login");
    }
  } else if (isLoginPage) {
    // Si sur la page de login et déjà connecté en tant qu'admin -> go dashboard
    if (session && isAdminUser(session.user)) {
      redirect("/admin/dashboard");
    }
  }

  // Pour les pages d'authentification, on n'affiche pas la Sidebar
  if (isStandaloneAuthPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar admin={session?.user || null} />

      <SidebarInset className="flex flex-col min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4 md:px-6">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className="-ml-1 h-11 w-11" aria-label="Basculer la barre latérale" />
              <div className="h-4 w-px bg-slate-200 mx-2" aria-hidden="true" />
              <AdminBreadcrumbs className="hidden sm:block" />
            </div>

            <div className="flex items-center gap-2">
              <AdminCommandPaletteTrigger />
              <NotificationCenter />
            </div>
          </div>
        </header>
        <main id="contenu-principal" className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
      <AdminCommandPalette />
    </SidebarProvider>
  );
}
