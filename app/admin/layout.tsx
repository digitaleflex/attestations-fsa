'use client';

import { ReactNode, useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(';').map(c => c.trim());
      const session = cookies.find(c => c.startsWith('admin_session='));
      if (!session) {
        router.push('/admin/login');
      } else {
        setIsAuth(true);
      }
    }
  }, [router]);

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

  if (!isAuth) return null;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="text-lg font-bold">Admin</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={false}>
                <a href="/admin/dashboard">Dashboard</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/attestations/new">Nouvelle attestation</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/formations/new">Nouvelle formation</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/attestations">Liste des attestations</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="p-8 min-h-screen bg-gray-100">
          <Suspense fallback={<div>Chargement...</div>}>
            {children}
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
} 