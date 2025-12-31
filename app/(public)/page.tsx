import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, ArrowRight, CheckCircle, Eye } from "lucide-react";
import { StatsDisplay } from "@/components/stats-display";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full animate-fade-in-up">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-8 sm:gap-12 mb-8">
        {/* Illustration personnalisée : certificat FSA + stagiaire heureux */}
        <div className="hidden sm:block flex-1">
          <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className="w-56 h-48 mx-auto">
            {/* Certificat */}
            <rect x="30" y="40" width="120" height="80" rx="14" fill="#fff" stroke="#16a34a" strokeWidth="3" filter="url(#shadow)" />
            <rect x="45" y="60" width="90" height="12" rx="4" fill="#bbf7d0" />
            <rect x="45" y="80" width="60" height="8" rx="4" fill="#dbeafe" />
            <circle cx="130" cy="100" r="10" fill="#facc15" stroke="#f59e42" strokeWidth="2" />
            <path d="M130 105 l5 8 l-10 0z" fill="#f59e42" />
            {/* Stagiaire */}
            <ellipse cx="170" cy="120" rx="22" ry="28" fill="#f0fdf4" />
            <circle cx="170" cy="110" r="12" fill="#2563eb" />
            <ellipse cx="170" cy="130" rx="10" ry="14" fill="#16a34a" />
            <rect x="165" y="120" width="10" height="8" rx="3" fill="#fff" />
            {/* Ombre */}
            <ellipse cx="90" cy="140" rx="70" ry="10" fill="#000" opacity="0.07" />
            <defs>
              <filter id="shadow" x="0" y="20" width="180" height="120" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.10" />
              </filter>
            </defs>
          </svg>
        </div>
        {/* Section héro */}
        <div className="flex-1 flex flex-col items-center gap-6 animate-fade-in-up delay-100">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2 tracking-tight font-display">Vérifiez une attestation FSA</h1>
          <p className="text-base sm:text-lg text-gray-600 mb-2 uppercase tracking-wider">Formations • Stages • Certifications</p>
          <p className="text-lg text-gray-700 mb-2 max-w-md">Ce service vous permet de vérifier l’authenticité des attestations délivrées par la <span className="font-bold text-green-700">Ferme St André</span> lors de nos formations, stages et certifications professionnelles.</p>
          <p className="text-sm text-gray-500 mb-2 italic">La confiance et la transparence sont au cœur de notre mission.</p>
          <Link
            href="/verifier"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-gradient-to-r from-green-600 to-blue-600 text-white font-bold text-lg shadow-xl hover:scale-105 hover:shadow-2xl focus:scale-105 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-green-600"
            aria-label="Vérifier une attestation"
          >
            Vérifier une attestation <ArrowRight className="w-5 h-5" />
          </Link>
          {/* Nouveau bouton pour scan QR */}

          <span className="text-green-700 text-sm mt-1">Service gratuit, instantané et sans collecte de données sensibles.</span>
          <StatsDisplay />
        </div>
      </div>
      {/* Avantages avec effet glassmorphism */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto animate-fade-in-up delay-200">
        <div className="flex flex-col items-center bg-white/60 backdrop-blur-md border border-green-100 rounded-xl shadow p-6 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 group focus-within:shadow-2xl focus-within:-translate-y-1" tabIndex={0} aria-label="Simplicité">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2 group-hover:text-green-700 group-focus:text-green-700 transition-colors" />
          <div className="font-bold text-gray-900 mb-1 flex items-center">Simplicité <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">Nouveau</span></div>
          <div className="text-gray-600 text-sm">Vérification instantanée par code unique ou QR code.</div>
        </div>
        <div className="flex flex-col items-center bg-white/60 backdrop-blur-md border border-blue-100 rounded-xl shadow p-6 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 group focus-within:shadow-2xl focus-within:-translate-y-1" tabIndex={0} aria-label="Sécurité">
          <ShieldCheck className="w-8 h-8 text-blue-500 mb-2 group-hover:text-blue-700 group-focus:text-blue-700 transition-colors" />
          <div className="font-bold text-gray-900 mb-1">Sécurité</div>
          <div className="text-gray-600 text-sm">Données protégées, aucune information sensible affichée.</div>
        </div>
        <div className="flex flex-col items-center bg-white/60 backdrop-blur-md border border-emerald-100 rounded-xl shadow p-6 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 group focus-within:shadow-2xl focus-within:-translate-y-1" tabIndex={0} aria-label="Transparence">
          <Eye className="w-8 h-8 text-emerald-500 mb-2 group-hover:text-emerald-700 group-focus:text-emerald-700 transition-colors" />
          <div className="font-bold text-gray-900 mb-1">Transparence</div>
          <div className="text-gray-600 text-sm">Authenticité vérifiable par tous, à tout moment.</div>
        </div>
      </div>
    </div>
  );
}
