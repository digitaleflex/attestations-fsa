'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LogOut } from 'lucide-react'

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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Tableau de bord administrateur</h1>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
    </div>
  )
}