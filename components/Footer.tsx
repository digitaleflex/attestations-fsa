import Link from "next/link";
import { Phone, MapPin } from "lucide-react";

/** Footer public réutilisable — palette Pinterest (#45). */
export function Footer() {
  return (
    <footer className="w-full border-t border-brand-line bg-white/70 backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand/20 to-transparent" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand/5 rounded-full blur-3xl opacity-50" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl opacity-50" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          <div className="lg:col-span-4 space-y-6">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
                <span className="text-white font-black text-xl uppercase tracking-tighter">Fsa</span>
              </div>
              <div>
                <h4 className="text-brand-ink font-black text-lg tracking-tight leading-none">
                  Ferme St André
                </h4>
                <p className="text-[10px] text-brand font-bold uppercase tracking-[0.2em] mt-1">L'Excellence Agricole</p>
              </div>
            </div>
            <p className="text-brand-muted text-sm leading-relaxed max-w-sm">
              Pionniers de l'agro-pisciculture durable au Bénin. Nous formons les leaders de demain à travers des programmes d'excellence et d'innovation.
            </p>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-5">
              <h5 className="text-brand-ink font-bold text-sm tracking-wide">Navigation</h5>
              <ul className="space-y-3">
                {[
                  { label: 'Accueil', href: '/' },
                  { label: 'Nos Formations', href: '/formations' },
                  { label: 'Examens', href: '/examens' },
                  { label: 'Demande de Stage', href: '/demande-stage' },
                  { label: 'Contact', href: '/contact' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-brand-muted hover:text-brand text-sm transition-colors flex items-center group">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand opacity-0 group-hover:opacity-100 mr-0 group-hover:mr-2 transition-all duration-300" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              <h5 className="text-brand-ink font-bold text-sm tracking-wide">Ressources</h5>
              <ul className="space-y-3">
                {[
                  { label: 'Centre d\'aide (FAQ)', href: '/faq' },
                  { label: 'Vérifier un Certificat', href: '/verifier' },
                  { label: 'Signaler un Problème', href: '/signalement' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-brand-muted hover:text-brand text-sm transition-colors flex items-center group">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand opacity-0 group-hover:opacity-100 mr-0 group-hover:mr-2 transition-all duration-300" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 md:col-span-1 space-y-5">
              <h5 className="text-brand-ink font-bold text-sm tracking-wide">Contact Rapide</h5>
              <div className="p-4 rounded-2xl bg-slate-50 border border-brand-line space-y-4 text-sm">
                <div className="flex items-center gap-3 text-slate-600 font-medium group cursor-pointer hover:text-brand transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-white border border-brand-line flex items-center justify-center text-brand shadow-sm transition-transform group-hover:scale-110">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span>+229 01 91 07 60 93</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600 font-medium group cursor-pointer hover:text-brand transition-colors">
                  <div className="w-8 h-8 rounded-xl bg-white border border-brand-line flex items-center justify-center text-brand shadow-sm transition-transform group-hover:scale-110">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <span>Abomey-Calavi, Bénin</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-brand-line flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 text-[11px] font-medium tracking-tight uppercase">
            &copy; {new Date().getFullYear()} <span className="text-brand-ink font-bold">Ferme St André</span>. Tous droits réservés.
          </p>
          <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <Link href="/legal/confidentialite" className="hover:text-brand transition-colors">Confidentialité</Link>
            <Link href="/legal/cgu" className="hover:text-brand transition-colors">CGU</Link>
            <Link href="/legal/mentions-legales" className="hover:text-brand transition-colors">Mentions légales</Link>
            <Link href="/legal/cookies" className="hover:text-brand transition-colors">Cookies</Link>
            <Link href="/legal/attestations" className="hover:text-brand transition-colors">Attestations</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
