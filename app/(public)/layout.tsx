import "../globals.css";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <header className="w-full flex justify-between items-center px-6 py-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Image src="/logo-fsa.png" alt="Logo FSA" width={48} height={48} />
            <span className="text-xl font-bold text-gray-900">Ferme St André</span>
          </div>
          <nav className="flex gap-2">
            <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-gray-800 hover:bg-gray-200 transition">
              Accueil
            </Link>
            <Link href="/verifier" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-900 transition">
              <ShieldCheck className="w-5 h-5" />
              Vérifier une attestation
            </Link>
          </nav>
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