"use client";

import * as React from "react";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Briefcase,
  CheckCircle,
  User,
  LogOut,
  Menu,
  BarChart3,
  HelpCircle,
  LifeBuoy,
  MessageCircle,
  Bell,
  GraduationCap,
  Award,
} from "lucide-react";
import { authClient, signOut } from "@/lib/auth-client";
import NotificationBell from "@/components/NotificationBell";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Vérification de l'utilisateur pour le menu
  const { data: user, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth");
        }
        throw new Error("Non autorisé");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = async () => {
    try {
      // 1. Better Auth Sign Out
      await signOut();
      // 2. Legacy API Logout
      await fetch("/api/auth/logout", { method: "POST" });

      toast.success("Déconnecté avec succès");
      router.push("/");
    } catch (err) {
      console.error("User logout error:", err);
      router.push("/");
    }
  };

  const menuItems = [
    { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    { name: "Mes Examens", href: "/exams", icon: ClipboardList },
    { name: "Mes Résultats", href: "/results", icon: BarChart3 },
    { name: "Mes Certifications", href: "/attestations", icon: Award },
    { name: "Stages & Projets", href: "/internships", icon: Briefcase },
    { name: "Mon Espace", href: "/profile", icon: User },
  ];

  // Mode Focus pour les examens (Pas de sidebar, pas de header)
  const isExamPage = pathname
    ? pathname.startsWith("/exams/") && pathname !== "/exams"
    : false;

  if (isExamPage) {
    // Mode focus : ni header ni menu, mais la cible du lien d'évitement
    // doit exister sur toutes les pages. `tabIndex={-1}` la rend focusable.
    return (
      <div
        id="contenu-principal"
        tabIndex={-1}
        className="min-h-screen bg-slate-50 focus:outline-none"
      >
        {children}
      </div>
    );
  }

  // Note: On retire le spinner bloquant pour éviter les "gels" d'interface en cas de latence réseau
  /* if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 rounded-full border-4 border-brand border-t-transparent animate-spin"></div>
      </div>
    );
  } */

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside
        id="candidate-sidebar"
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200/60 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 z-20 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-20 flex items-center px-5 border-b border-slate-100 justify-between">
          <div
            className="flex items-center gap-3 overflow-hidden"
            title="Ferme Agro-piscicole St Andre"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold shadow-sm">
              FSA
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 tracking-tight whitespace-nowrap text-xs">
                  Agro-piscicole
                </span>
                <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                  St Andre
                </span>
              </div>
            )}
          </div>
        </div>

        <nav
          // Libellé distinct de celui du menu mobile (« Navigation mobile
          // candidat ») : deux points de navigation portant le même nom
          // confondent les listes de liens d'un lecteur d'écran, qui ne peut
          // alors plus dire lequel il parcourt. Les deux ne sont de toute façon
          // jamais exposés ensemble (l'un est `hidden` sous `lg`, l'autre
          // n'existe que panneau ouvert).
          aria-label="Navigation latérale candidat"
          className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 scrollbar-hide"
        >
          {menuItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (pathname && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.name}
                href={item.href}
                // `aria-current` : sans lui, la page courante n'est signalée ni
                // aux lecteurs d'écran ni en couleur seule. Le menu mobile le
                // portait déjà ; on aligne le menu latéral.
                aria-current={isActive ? "page" : undefined}
                // Menue réduit : le libellé n'est plus dans le DOM, seul
                // l'icône reste. `aria-label` garde un nom accessible fiable
                // là où `title` (non fiable, dépend du navigateur) suffisait.
                aria-label={isSidebarOpen ? undefined : item.name}
              >
                <div
                  className={`flex items-center gap-3.5 px-3 py-3 rounded-xl transition-all duration-300 group ${
                    isActive
                      ? "bg-brand text-white shadow-md shadow-brand/25 scale-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
                  }`}
                  title={!isSidebarOpen ? item.name : undefined}
                >
                  <item.icon
                    className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? "text-white" : "text-slate-500 group-hover:text-brand"}`}
                    aria-hidden="true"
                  />
                  {isSidebarOpen && (
                    <span className="font-medium whitespace-nowrap tracking-wide text-sm">
                      {item.name}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
            title={!isSidebarOpen ? "Déconnexion" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {isSidebarOpen && (
              <span className="font-medium whitespace-nowrap text-sm">
                Déconnexion
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header (Top Navbar) */}
        <header className="h-20 bg-white border-b border-slate-200/60 shadow-sm flex items-center justify-between px-6 lg:px-10 z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Ouvrir le menu"
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="candidate-mobile-menu"
                  className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <Menu className="w-6 h-6" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent
                id="candidate-mobile-menu"
                side="left"
                className="flex w-80 max-w-[85vw] flex-col bg-white p-0 shadow-2xl sm:max-w-[85vw]"
                overlayClassName="bg-slate-900/40 backdrop-blur-sm"
              >
                <SheetTitle className="sr-only">Menu candidat</SheetTitle>
                <SheetDescription className="sr-only">
                  Accéder aux espaces du candidat.
                </SheetDescription>
                <div className="flex h-20 flex-shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-sm font-bold text-white shadow-md">
                      FSA
                    </div>
                    <span className="font-bold tracking-tight text-slate-800">
                      Portail Candidat
                    </span>
                  </div>
                </div>
                <nav
                  aria-label="Navigation mobile candidat"
                  className="flex-1 space-y-2 overflow-y-auto px-4 py-6"
                >
                  {menuItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (pathname && pathname.startsWith(`${item.href}/`));
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 font-medium transition-colors ${isActive ? "border-brand/20 bg-brand/10 text-brand-dark shadow-sm" : "border-transparent text-slate-600 hover:bg-slate-50"}`}
                      >
                        <item.icon
                          className={`h-5 w-5 ${isActive ? "text-brand" : "text-slate-500"}`}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
                <div className="flex-shrink-0 border-t border-slate-100 bg-slate-50/50 p-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3.5 font-semibold text-rose-600 shadow-sm transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-5 w-5" aria-hidden="true" />
                    Déconnexion
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <button
              type="button"
              className="hidden lg:flex h-11 w-11 items-center justify-center text-slate-500 hover:text-brand hover:bg-brand/10 rounded-xl transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={
                isSidebarOpen
                  ? "Réduire le menu latéral"
                  : "Déplier le menu latéral"
              }
              aria-expanded={isSidebarOpen}
              aria-controls="candidate-sidebar"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <h2 className="hidden sm:block text-xl font-bold text-slate-800 tracking-tight">
              {menuItems.find(
                (i) =>
                  pathname === i.href ||
                  (pathname && pathname.startsWith(`${i.href}/`)),
              )?.name || "Espace Candidat"}
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <NotificationBell />
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-default">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand/20 to-brand-accent/10 text-brand border border-brand/20 flex items-center justify-center font-bold text-sm shadow-inner">
                {user?.name?.charAt(0) || <User className="w-4 h-4" />}
              </div>
              <span className="hidden md:block text-sm font-semibold text-slate-700 pr-3">
                {user?.name || "Candidat"}
              </span>
            </div>
          </div>
        </header>

        {/* Banner pour email non vérifié */}
        <EmailVerificationBanner user={user} />

        {/* Page Content area */}
        <main
          id="contenu-principal"
          // `tabIndex={-1}` : rend la cible du lien d'évitement « Aller au
          // contenu principal » réellement focusable (le conteneur est un
          // Palier de défilement, pas un élément focusable par défaut).
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-10 relative scrollbar-hide focus:outline-none"
        >
          <div className="mx-auto max-w-6xl animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out pb-20">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
