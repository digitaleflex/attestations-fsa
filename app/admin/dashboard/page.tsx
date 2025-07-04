"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, FileText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminDashboard() {
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();
  const [userCount, setUserCount] = useState<number|null>(null);
  const [docCount, setDocCount] = useState<number|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim());
      const session = cookies.find(c => c.startsWith('admin_session='));
      if (!session) {
        router.push('/admin/login');
      } else {
        setIsAuth(true);
      }
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/users').then(res => res.json()).then(data => data.count),
      fetch('/api/attestations?count=1').then(res => res.json()).then(data => data.count)
    ]).then(([users, docs]) => {
      setUserCount(users);
      setDocCount(docs);
    }).finally(() => setLoading(false));
  }, []);

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

  if (!isAuth) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="text-lg font-bold">Admin</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={true}>
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
          <h1 className="text-3xl font-bold mb-6">Tableau de bord administrateur</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-green-100 border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Users className="text-green-600 w-8 h-8" />
                <CardTitle className="text-green-900 font-bold text-lg">Utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-green-900">{userCount}</p>}
                <p className="text-sm text-green-800">Utilisateurs enregistrés</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-100 border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <FileText className="text-blue-600 w-8 h-8" />
                <CardTitle className="text-blue-900 font-bold text-lg">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-blue-900">{docCount}</p>}
                <p className="text-sm text-blue-800">Attestations enregistrées</p>
              </CardContent>
            </Card>
            <Card className="bg-yellow-100 border-0 shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Activity className="text-yellow-600 w-8 h-8" />
                <CardTitle className="text-yellow-900 font-bold text-lg">Activité récente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-yellow-800">Aucune activité récente</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}