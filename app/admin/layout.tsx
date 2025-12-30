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
      <Sidebar>
        <SidebarHeader>
          <div className="md:hidden mb-2">
            <SidebarTrigger />
          </div>
          <span className="text-lg font-bold">Admin FSA</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem
              icon={<Home />}
              label="Dashboard"
              href="/admin/dashboard"
            />
            <SidebarMenuItem
              icon={<FileText />}
              label="Nouvelle attestation"
              href="/admin/attestations/new"
            />
            <SidebarMenuItem
              icon={<GraduationCap />}
              label="Nouvelle formation"
              href="/admin/formations/new"
            />
            <SidebarMenuItem
              icon={<FileText />}
              label="Liste des attestations"
              href="/admin/attestations"
            />
            <SidebarMenuItem
              icon={<GraduationCap />}
              label="Liste des formations"
              href="/admin/formations"
            />
            <SidebarMenuItem
              icon={<BarChart2 />}
              label="Statistiques"
              href="/admin/stats"
            />
            <SidebarMenuItem
              icon={<Settings />}
              label="Paramètres"
              href="/admin/settings"
            />
            <SidebarMenuItem
              icon={<AlertCircle />}
              label="Signalements"
              href="/admin/signalements"
              badge={signalementsCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white animate-pulse">{signalementsCount}</span>
              )}
            />
            <SidebarMenuItem
              icon={<LogOut />}
              label="Déconnexion"
              href="#"
              onClick={handleLogout}
            />
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <span className="font-semibold">Administration</span>
        </header>
        <main className="p-4 md:p-8 min-h-screen bg-gray-100 flex flex-col w-full">
          <Suspense fallback={<div>Chargement...</div>}>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 