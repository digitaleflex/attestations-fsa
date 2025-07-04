'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from '@/components/ui/sidebar'

export default function AdminDashboard() {
  const [isAuth, setIsAuth] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map(c => c.trim())
      const session = cookies.find(c => c.startsWith('admin_session='))
      if (!session) {
        router.push('/admin/login')
      } else {
        setIsAuth(true)
      }
    }
  }, [router])

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        router.push('/admin/login')
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
    }
  }

  if (!isAuth) {
    return null // ou un loader
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
            <Card className="bg-white border border-gray-300 shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900 font-bold">Utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-700">Utilisateurs enregistrés</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-gray-300 shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900 font-bold">Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">0</p>
                <p className="text-sm text-gray-700">Documents enregistrés</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-gray-300 shadow-md">
              <CardHeader>
                <CardTitle className="text-gray-900 font-bold">Activité récente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">Aucune activité récente</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}