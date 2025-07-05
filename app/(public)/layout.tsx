"use client";
import "../globals.css";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Menu, X } from "lucide-react";
import { useState } from "react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // Menu mobile state (client only)
  const [open, setOpen] = useState(false);

  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <header className="w-full flex justify-between items-center px-6 py-4 max-w-4xl mx-auto relative">
          <div className="flex items-center gap-2">
            <Image src="/logo-fsa.png" alt="Logo FSA" width={48} height={48} />
            <span className="text-xl font-bold text-gray-900">Ferme St André</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden sm:flex gap-2">
            <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-gray-800 hover:bg-gray-200 transition">
              Accueil
            </Link>
            <Link href="/verifier" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-900 transition">
              <ShieldCheck className="w-5 h-5" />
              Vérifier une attestation
            </Link>
          </nav>
          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg hover:bg-gray-200 transition focus:outline-none focus:ring-2 focus:ring-black"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen(o => !o)}
            type="button"
          >
            {open ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
          {/* Mobile menu */}
          {open && (
            <div
              className="sm:hidden absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border z-50 animate-fade-in"
              tabIndex={-1}
              role="menu"
              aria-label="Menu navigation mobile"
            >
              <Link
                href="/"
                className="block px-6 py-4 text-gray-900 font-semibold hover:bg-gray-100 rounded-t-xl"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                Accueil
              </Link>
              <Link
                href="/verifier"
                className="block px-6 py-4 text-gray-900 font-semibold hover:bg-gray-100 rounded-b-xl border-t"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" /> Vérifier une attestation
                </span>
              </Link>
            </div>
          )}
        </header>
        {/* Contenu */}
        <main className="flex-1 w-full flex flex-col items-center justify-center">
          {children}
        </main>
        {/* Footer */}
        <footer className="w-full text-center text-gray-500 text-sm py-6 border-t mt-12 bg-white/60">
          &copy; {new Date().getFullYear()} Ferme St André. Tous droits réservés.
        </footer>
      </body>
    </html>
  );
} 