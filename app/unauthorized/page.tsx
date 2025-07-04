'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function Unauthorized() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Accès refusé</h1>
        <p className="mt-2 text-gray-600">
          Vous n'avez pas les autorisations nécessaires pour accéder à cette page.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push('/admin/login')}>
            Retour à la page de connexion
          </Button>
        </div>
      </div>
    </div>
  )
}
