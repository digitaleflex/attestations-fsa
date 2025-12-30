'use client'

import * as React from "react"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Mail, AlertCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const [year, setYear] = useState<number | null>(null)
  const queryClient = useQueryClient();

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // <-- Correction pour stocker le cookie
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Échec de la connexion')
      }

      // Redirection directe après succès
      router.push('/admin/dashboard')
      return
    } catch (err) {
      console.error('Erreur de connexion:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setIsLoading(false)
    }
  }

  return (
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden">
      {/* Animated Background Mesh */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-500 opacity-20 blur-3xl transform scale-150 animate-pulse duration-10000"></div>
      <div className="absolute inset-0 bg-white/40 backdrop-blur-3xl"></div>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="glass-panel rounded-2xl overflow-hidden border-t-4 border-t-indigo-500 shadow-2xl">
          <div className="p-8 md:p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xl mb-4 shadow-lg">
                F
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Bienvenue</h1>
              <p className="text-slate-500 text-sm">Connectez-vous à la plateforme d'administration FSA</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5 ml-1">
                  Adresse email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-3 border ${error ? 'border-rose-300 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'} rounded-xl bg-slate-50/50 focus:bg-white shadow-sm focus:outline-none focus:ring-4 transition-all duration-200 text-slate-900 placeholder:text-slate-400`}
                    placeholder="admin@exemple.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
                  <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                    Mot de passe oublié ?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`block w-full pl-10 pr-3 py-3 border ${error ? 'border-rose-300 focus:ring-rose-200' : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'} rounded-xl bg-slate-50/50 focus:bg-white shadow-sm focus:outline-none focus:ring-4 transition-all duration-200 text-slate-900 placeholder:text-slate-400`}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-2">
                <motion.button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  whileTap={{ scale: 0.98 }}
                  onMouseEnter={() => queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => fetch('/admin/dashboard').then(res => res.text()) })}
                  onFocus={() => queryClient.prefetchQuery({ queryKey: ['dashboard'], queryFn: () => fetch('/admin/dashboard').then(res => res.text()) })}
                  className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/30 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all duration-200 ${isLoading || !email || !password ? 'opacity-70 cursor-not-allowed grayscale' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Connexion...
                    </>
                  ) : 'Se connecter'}
                </motion.button>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  Pas encore de compte?{' '}
                  <a href="/admin/register" className="font-semibold text-indigo-600 hover:text-indigo-500 hover:underline decoration-2 underline-offset-2">
                    Créer un compte
                  </a>
                </p>
              </div>
            </form>
          </div>

          <div className="bg-slate-50/80 px-8 py-4 border-t border-slate-100 text-center backdrop-blur-sm">
            <p className="text-xs text-slate-400 font-medium">
              © {year ?? ''} Attestation FSA. Tous droits réservés.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
