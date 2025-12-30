'use client';

import * as React from "react";
import { ReactNode, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, Home, GraduationCap, BarChart2, Settings, AlertCircle } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState<boolean | null>(null); // null = vérification en cours
  const router = useRouter();
  const pathname = usePathname();
  const [signalementsCount, setSignalementsCount] = useState<number>(0);

  useEffect(() => {
    if (isAuth) {
      fetch('/api/signalement?countOnly=1')
        .then(res => res.json())
        .then(data => setSignalementsCount(data.count || 0))
        .catch(err => console.error(err));
    }
  }, [isAuth]);

  useEffect(() => {
    if (pathname === '/admin/login') return; // Ne rien faire sur la page login
    if (typeof document !== "undefined") {
      // Log pour debug
      console.log("[AdminLayout] Cookies:", document.cookie);
      // Recherche robuste du cookie admin_session
      const cookies = document.cookie.split(';').map(c => c.trim());
      const session = cookies.find(c => c.toLowerCase().startsWith('admin_session='));
      if (!session) {
        setIsAuth(false);
        router.push('/admin/login');
      } else {
        setIsAuth(true);
      }
    }
  }, [router, pathname]);

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  if (isAuth === null) {
    // Affiche un message d'attente pendant la vérification
    return <div className="flex items-center justify-center min-h-screen">Vérification de l'authentification...</div>;
  }
  if (!isAuth) return null;

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-white/20 bg-white/50 backdrop-blur-xl shadow-lg" collapsible="icon">
        <SidebarHeader className="border-b border-black/5 p-4">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
              F
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-slate-900">Admin FSA</span>
              <span className="truncate text-xs text-slate-500">Platform Admin</span>
            </div>
          </div>
          {/* Bouton d'ouverture de la sidebar sur mobile */}
          <div className="md:hidden mt-2">
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarMenu>
            <SidebarMenuItem
              icon={<Home className="text-indigo-500" />}
              label="Dashboard"
              href="/admin/dashboard"
              className="hover:bg-indigo-50/50 hover:text-indigo-600 transition-colors rounded-md mb-1"
            />
            <div className="px-4 py-2 mt-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Gestion</div>
            <SidebarMenuItem
              icon={<FileText className="text-slate-500" />}
              label="Créer Attestation"
              href="/admin/attestations/new"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />
            <SidebarMenuItem
              icon={<GraduationCap className="text-slate-500" />}
              label="Créer Formation"
              href="/admin/formations/new"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />
            <SidebarMenuItem
              icon={<FileText className="text-slate-500" />}
              label="Toutes les attestations"
              href="/admin/attestations"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />
            <SidebarMenuItem
              icon={<GraduationCap className="text-slate-500" />}
              label="Toutes les formations"
              href="/admin/formations"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />

            <div className="px-4 py-2 mt-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Système</div>
            <SidebarMenuItem
              icon={<BarChart2 className="text-slate-500" />}
              label="Statistiques"
              href="/admin/stats"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />
            <SidebarMenuItem
              icon={<Settings className="text-slate-500" />}
              label="Paramètres"
              href="/admin/settings"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
            />
            <SidebarMenuItem
              icon={<AlertCircle className="text-slate-500" />}
              label="Signalements"
              href="/admin/signalements"
              className="hover:bg-slate-100 transition-colors rounded-md mb-1"
              badge={signalementsCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-rose-500 text-[10px] font-medium text-white shadow-sm animate-pulse">{signalementsCount}</span>
              )}
            />
          </SidebarMenu>
        </SidebarContent>

        <div className="mt-auto border-t border-black/5 p-4">
          <SidebarMenu>
            <SidebarMenuItem
              icon={<LogOut className="text-slate-400" />}
              label="Déconnexion"
              href="#"
              onClick={handleLogout}
              className="hover:bg-rose-50 hover:text-rose-600 transition-colors rounded-md"
            />
          </SidebarMenu>
        </div>
      </Sidebar>
      <SidebarInset className="bg-slate-50/50">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-indigo-100 bg-white/80 px-6 backdrop-blur-md md:hidden sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 text-slate-600 hover:bg-slate-100" />
            <span className="font-semibold text-slate-800">Admin FSA</span>
          </div>
        </header>
        <main className="flex flex-col w-full min-h-screen p-4 md:p-8 space-y-6">
          <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-400">Chargement...</div>}>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 