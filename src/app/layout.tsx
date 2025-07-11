import * as React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '@/components/ui/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tableau de bord administrateur',
  description: 'Gestion des utilisateurs et des documents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
