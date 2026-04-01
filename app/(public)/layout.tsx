"use client";
import "../globals.css";
import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Menu, X, LogIn, UserPlus, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  // Menu mobile state (client only)
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="w-full flex justify-between items-center px-8 py-3 relative sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/logo-fsa.png" alt="Logo FSA" width={40} height={40} className="rounded-lg" />
          <span className="text-lg font-bold text-gray-900">Ferme Agro-Piscicole Cité St André</span>
        </div>
        {/* Desktop nav */}
        <nav className="hidden sm:flex gap-1 items-center">
          <Link href="/" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-all">
            Accueil
          </Link>
          <Link href="/demande-stage" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-gray-600 hover:text-blue-700 hover:bg-blue-50 transition-all">
            Stages
          </Link>
          <Link href="/exams" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all">
            Examens
          </Link>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          {session ? (
            <button 
              onClick={() => {
                import("@/lib/auth-client").then(m => m.signOut());
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              Déconnexion
            </button>
          ) : (
            <Link href="/auth" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all hover:shadow-sm">
              <LogIn className="w-4 h-4" />
              Se connecter
            </Link>
          )}
          <Link href="/verifier" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-semibold hover:from-emerald-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
            <ShieldCheck className="w-5 h-5" />
            Vérifier
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
            className="sm:hidden absolute top-full right-0 mt-2 w-56 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 z-50 animate-fade-in"
            tabIndex={-1}
            role="menu"
            aria-label="Menu navigation mobile"
          >
            <Link
              href="/"
              className="block px-5 py-3 text-gray-700 font-medium hover:bg-gray-100 rounded-t-xl transition-all"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Accueil
            </Link>
            <Link
              href="/demande-stage"
              className="block px-5 py-3 text-gray-700 font-medium hover:bg-blue-50 hover:text-blue-700 border-t border-gray-100 transition-all"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Stages
            </Link>
            <Link
              href="/exams"
              className="block px-5 py-3 text-gray-700 font-medium hover:bg-emerald-50 hover:text-emerald-700 border-t border-gray-100 transition-all"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              Examens
            </Link>
            {session ? (
              <button
                onClick={async () => {
                  const { signOut } = await import("@/lib/auth-client");
                  await signOut();
                  setOpen(false);
                }}
                className="w-full text-left block px-5 py-3 text-slate-600 font-medium bg-slate-50 hover:bg-slate-100 border-t border-gray-100 transition-all"
                role="menuitem"
              >
                Déconnexion
              </button>
            ) : (
              <Link
                href="/auth"
                className="block px-5 py-3 text-emerald-700 font-medium bg-emerald-50 hover:bg-emerald-100 border-t border-gray-100 transition-all"
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                <span className="inline-flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </span>
              </Link>
            )}
            <Link
              href="/verifier"
              className="block px-5 py-3 text-white font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 border-t border-gray-100 rounded-b-xl mt-2 shadow-md transition-all"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Vérifier
              </span>
            </Link>
          </div>
        )}
      </header>
      {/* Contenu */}
      <main className="flex-1 w-full flex flex-col items-center justify-center pt-8">
        {children}
      </main>
      {/* Footer */}
      <footer className="w-full text-center text-gray-500 text-sm py-8 border-t mt-12 bg-white/60">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 mb-2">
            <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link>
            <Link href="/signalement" className="hover:text-red-600 transition-colors">Signaler un problème</Link>
            <Link href="/verifier" className="hover:text-emerald-600 transition-colors">Vérifier</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Ferme Agro-Piscicole Cité St André. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
} 