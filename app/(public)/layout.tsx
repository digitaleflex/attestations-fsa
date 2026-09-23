import "../globals.css";
import * as React from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ferme Agro-piscicole St Andre - Portail Officiel',
  description: 'Spécialistes en Pisciculture, Agriculture et Élevage au Bénin. Formations certifiantes de haut niveau et programmes de stages pratiques immersifs.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-gray-50 to-slate-100 font-sans selection:bg-brand selection:text-white">
      {/* Navigation Client */}
      <PublicHeader />

      {/* Contenu Principal */}
      <main id="contenu-principal" className="flex-1 w-full flex flex-col items-center justify-center pt-4 md:pt-8 bg-grid-slate-100 bg-[size:40px_40px] relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,theme(colors.white),transparent)] opacity-70" />
        {children}
      </main>

      {/* Footer réutilisable */}
      <Footer />
    </div>
  );
}
