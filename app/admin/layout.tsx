import * as React from "react";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import NotificationCenter from "@/components/admin/NotificationCenter";
import PusherAdminListener from "@/components/admin/PusherAdminListener";

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
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/register" ||
    pathname === "/admin/signup";

  // Sécurité Stricte (RSC Validation)
  if (!isLoginPage) {
    // Si pas connecté ou pas admin -> on bloque et on redirige
    if (!session || session.user.role?.toLowerCase() !== "admin") {
      redirect("/admin/login");
    }
  } else {
    // Si sur la page de login et déjà connecté en tant qu'admin -> go dashboard
    if (session && session.user.role?.toLowerCase() === "admin") {
      redirect("/admin/dashboard");
    }
  }

  // Pour la page de login des non-connectés, on n'affiche pas la Sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar admin={session?.user || null} />

      <SidebarInset className="flex flex-col min-h-screen bg-slate-50">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <div className="flex-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <div className="h-4 w-px bg-slate-200 mx-2" />
              <h1 className="hidden sm:block text-sm font-medium text-slate-600">
                Admin | Ferme Agro-Piscicole Cité St André
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <NotificationCenter />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>

      <PusherAdminListener />
    </SidebarProvider>
  );
}
