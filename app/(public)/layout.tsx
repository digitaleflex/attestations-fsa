import "../globals.css";
import * as React from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { Facebook, Twitter, Instagram, Linkedin, ExternalLink, Phone, MapPin } from "lucide-react";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ferme Agro-piscicole St Andre - Portail Officiel',
  description: 'Spécialistes en Pisciculture, Agriculture et Élevage au Bénin. Formations certifiantes de haut niveau et programmes de stages pratiques immersifs.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-br from-gray-50 to-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Navigation Client */}
      <PublicHeader />
      
      {/* Contenu Principal */}
      <main className="flex-1 w-full flex flex-col items-center justify-center pt-4 md:pt-8 bg-grid-slate-100 bg-[size:40px_40px] relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,theme(colors.white),transparent)] opacity-70" />
        {children}
      </main>

      {/* Footer Premium */}
      <footer className="w-full border-t border-slate-200/60 bg-white/70 backdrop-blur-xl relative overflow-hidden">
        {/* Subtle Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl opacity-50" />

        <div className="max-w-7xl mx-auto px-6 pt-16 pb-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
            {/* Brand Section */}
            <div className="lg:col-span-4 space-y-6">
              <div className="inline-flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                  <span className="text-white font-bold text-xl uppercase tracking-tighter">Fsa</span>
                </div>
                <div>
                  <h4 className="text-slate-900 font-extrabold text-lg tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                    Ferme St André
                  </h4>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-[0.2em] mt-1">L'Excellence Agricole</p>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                Pionniers de l'agro-pisciculture durable au Bénin. Nous formons les leaders de demain à travers des programmes d'excellence et d'innovation.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: Facebook, color: "hover:bg-blue-50 hover:text-blue-600" },
                  { icon: Twitter, color: "hover:bg-sky-50 hover:text-sky-500" },
                  { icon: Instagram, color: "hover:bg-pink-50 hover:text-pink-600" },
                  { icon: Linkedin, color: "hover:bg-indigo-50 hover:text-indigo-600" }
                ].map((social, i) => (
                  <a key={i} href="#" className={`w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 transition-all duration-300 ${social.color}`}>
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Navigation Sections */}
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
              <div className="space-y-5">
                <h5 className="text-slate-900 font-bold text-sm tracking-wide">Navigation</h5>
                <ul className="space-y-3">
                  {[
                    { label: 'Accueil', href: '/' },
                    { label: 'Stages & Formations', href: '/demande-stage' },
                    { label: 'Examens & Résultats', href: '/exams' }
                  ].map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-slate-500 hover:text-emerald-600 text-sm transition-colors flex items-center group">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 mr-0 group-hover:mr-2 transition-all duration-300" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-5">
                <h5 className="text-slate-900 font-bold text-sm tracking-wide">Ressources</h5>
                <ul className="space-y-3">
                  {[
                    { label: 'Centre d\'aide (FAQ)', href: '/faq' },
                    { label: 'Vérifier Certificat', href: '/verifier' },
                    { label: 'Signaler un Problème', href: '/signalement' }
                  ].map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-slate-500 hover:text-emerald-600 text-sm transition-colors flex items-center group">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 mr-0 group-hover:mr-2 transition-all duration-300" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-2 md:col-span-1 space-y-5">
                <h5 className="text-slate-900 font-bold text-sm tracking-wide">Contact Rapide</h5>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 text-sm">
                  <div className="flex items-center gap-3 text-slate-600 font-medium group cursor-pointer hover:text-emerald-600 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm transition-transform group-hover:scale-110">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <span>+229 01 01 01 01</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 font-medium group cursor-pointer hover:text-emerald-600 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm transition-transform group-hover:scale-110">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span>Cotonou, Bénin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 text-[11px] font-medium tracking-tight uppercase">
              &copy; {new Date().getFullYear()} <span className="text-slate-600 font-bold">Ferme St André</span>. Tous droits réservés.
            </p>
            <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Link href="#" className="hover:text-emerald-600 transition-colors">Confidentialité</Link>
              <Link href="#" className="hover:text-emerald-600 transition-colors">Conditions</Link>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <Link href="#" className="hover:text-emerald-600 transition-colors">Plan du site</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 