"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, FileText, CheckCircle, Clock, PlusCircle, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function AdminDashboard() {
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();
  const [stats, setStats] = useState({
    attestations: 0,
    attestationsPending: 0,
    attestationsValidated: 0,
    formations: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [lastAttestations, setLastAttestations] = useState<any[]>([]);
  const [loadingLast, setLoadingLast] = useState(true);

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
    setLoadingStats(true);
    Promise.all([
      fetch('/api/attestations?count=1').then(res => res.json()),
      fetch('/api/attestations?status=PENDING&count=1').then(res => res.json()),
      fetch('/api/attestations?status=VALIDATED&count=1').then(res => res.json()),
      fetch('/api/formations').then(res => res.json()),
    ]).then(([all, pending, validated, formations]) => {
      setStats({
        attestations: all.count || 0,
        attestationsPending: pending.count || 0,
        attestationsValidated: validated.count || 0,
        formations: Array.isArray(formations) ? formations.length : 0,
      });
    }).finally(() => setLoadingStats(false));
  }, []);

  useEffect(() => {
    setLoadingLast(true);
    fetch('/api/attestations?limit=5&order=desc')
      .then(res => res.json())
      .then(data => setLastAttestations(Array.isArray(data) ? data : []))
      .finally(() => setLoadingLast(false));
  }, []);

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
                <a href="/admin/formations">Liste des formations</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <a href="/admin/attestations">Liste des attestations</a>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Button variant="outline" className="w-full justify-start" onClick={() => {
                fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                  .then(() => router.push('/admin/login'));
              }}>
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="w-full p-8 min-h-screen bg-gray-100 flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 w-full">
            <h1 className="text-3xl font-bold text-center md:text-left w-full">Tableau de bord administrateur</h1>
            <div className="flex gap-2 justify-center md:justify-end w-full">
              <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push('/admin/attestations/new')}>
                <PlusCircle className="w-4 h-4 mr-2" /> Ajouter une attestation
              </Button>
              <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => router.push('/admin/formations/new')}>
                <PlusCircle className="w-4 h-4 mr-2" /> Ajouter une formation
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 w-full">
            <Card className="bg-blue-100 border-0 shadow-md hover:scale-[1.03] transition-transform">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <FileText className="text-blue-600 w-8 h-8" aria-hidden="true" />
                <CardTitle className="text-blue-900 font-bold text-lg">Attestations</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-blue-900">{stats.attestations}</p>}
                <p className="text-sm text-blue-800">Total</p>
              </CardContent>
            </Card>
            <Card className="bg-yellow-100 border-0 shadow-md hover:scale-[1.03] transition-transform cursor-pointer" onClick={() => router.push('/admin/attestations?status=PENDING')}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Clock className="text-yellow-600 w-8 h-8" aria-hidden="true" />
                <CardTitle className="text-yellow-900 font-bold text-lg">En attente</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-yellow-900">{stats.attestationsPending}</p>}
                <p className="text-sm text-yellow-800">Attestations à valider</p>
              </CardContent>
            </Card>
            <Card className="bg-green-100 border-0 shadow-md hover:scale-[1.03] transition-transform">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <CheckCircle className="text-green-600 w-8 h-8" aria-hidden="true" />
                <CardTitle className="text-green-900 font-bold text-lg">Validées</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-green-900">{stats.attestationsValidated}</p>}
                <p className="text-sm text-green-800">Attestations validées</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-100 border-0 shadow-md hover:scale-[1.03] transition-transform">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <GraduationCap className="text-purple-600 w-8 h-8" aria-hidden="true" />
                <CardTitle className="text-purple-900 font-bold text-lg">Formations</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-bold text-purple-900">{stats.formations}</p>}
                <p className="text-sm text-purple-800">Total</p>
              </CardContent>
            </Card>
            <Card className="bg-indigo-100 border-0 shadow-md hover:scale-[1.03] transition-transform cursor-pointer" onClick={() => router.push('/admin/stats')}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-200"><span className="text-indigo-700 font-bold text-lg" aria-hidden="true">%</span></span>
                <CardTitle className="text-indigo-900 font-bold text-lg">Taux de validation</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingStats || stats.attestations === 0 ? <Skeleton className="h-8 w-20" /> : (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-indigo-900">{Math.round((stats.attestationsValidated / stats.attestations) * 100)}%</span>
                    <span className="text-sm text-indigo-800">validées</span>
                  </div>
                )}
                <Button variant="link" className="text-indigo-700 mt-2 p-0 h-auto" onClick={() => router.push('/admin/stats')} aria-label="Voir les statistiques">Voir les statistiques</Button>
              </CardContent>
            </Card>
          </div>
          <div className="bg-white rounded-xl shadow-md p-8 w-full">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="text-blue-600 w-6 h-6" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Dernières attestations créées</h2>
            </div>
            {loadingLast ? (
              <Skeleton className="h-32 w-full" />
            ) : lastAttestations.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">Aucune attestation récente.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date émission</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lastAttestations.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                        <TableCell>{a.fullName}</TableCell>
                        <TableCell>{a.status}</TableCell>
                        <TableCell>{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild aria-label="Voir le détail de l’attestation">
                            <a href={`/admin/attestations/${a.id}`} aria-label="Voir le détail de l’attestation">
                              <FileText className="w-4 h-4" aria-hidden="true" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}