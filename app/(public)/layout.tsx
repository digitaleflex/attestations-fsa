import "../globals.css";
import * as React from "react";
import { PublicHeader } from "@/components/PublicHeader";
import { Footer } from "@/components/Footer";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ferme Agro-piscicole Saint André — Portail officiel',
  description: 'Spécialistes en Pisciculture, Agriculture et Élevage au Bénin. Formations certifiantes de haut niveau et programmes de stages pratiques immersifs.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell flex min-h-screen flex-col items-center justify-between bg-gradient-to-br from-slate-50 to-white font-sans text-brand-ink selection:bg-brand selection:text-white">
      {/* Navigation Client */}
      <PublicHeader />

      {/* Contenu Principal */}
      <main id="contenu-principal" tabIndex={-1} className="relative isolate flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(230,0,35,0.045),transparent_32rem)] bg-[length:100%_100%] pt-4 focus:outline-none md:pt-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid-slate-100 bg-[size:40px_40px] opacity-60" />
        {children}
      </main>

      {/* Footer réutilisable */}
      <Footer />
    </div>
  );
}
