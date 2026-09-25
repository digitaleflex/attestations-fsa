import Link from "next/link";
import { Phone, MapPin } from "lucide-react";

/** Footer public réutilisable — identité FSA en mode clair. */
export function Footer() {
  return (
    <footer className="relative w-full overflow-hidden border-t border-brand-line bg-white">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
      <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand/5 blur-3xl" />
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-accent/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-6 pt-8 sm:px-6 md:pb-10 md:pt-12 lg:px-8 lg:pt-16">
        <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-8 md:mb-12 lg:grid-cols-12 lg:gap-10">
          <div className="col-span-2 lg:col-span-4">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-extrabold text-sm tracking-tight text-white shadow-md shadow-brand/20">
                FSA
              </div>
              <div>
                <h2 className="text-sm font-extrabold leading-tight tracking-tight text-brand-ink">
                  Ferme Agro-piscicole
                </h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Saint André</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:col-span-8 lg:gap-8">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink">Navigation</h3>
              <ul className="mt-4 space-y-2.5">
                {[
                  { label: 'Accueil', href: '/' },
                  { label: 'Nos Formations', href: '/formations' },
                  { label: 'Examens', href: '/examens' },
                  { label: 'Demande de Stage', href: '/demande-stage' },
                  { label: 'Contact', href: '/contact' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="group inline-flex items-center text-xs leading-5 text-brand-muted transition-colors hover:text-brand sm:text-sm">
                      <span className="mr-0 h-1.5 w-1.5 rounded-full bg-brand opacity-0 transition-all group-hover:mr-2 group-hover:opacity-100" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink">Ressources</h3>
              <ul className="mt-4 space-y-2.5">
                {[
                  { label: 'Centre d\'aide (FAQ)', href: '/faq' },
                  { label: 'Vérifier un Certificat', href: '/verifier' },
                  { label: 'Signaler un Problème', href: '/signalement' }
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="group inline-flex items-center text-xs leading-5 text-brand-muted transition-colors hover:text-brand sm:text-sm">
                      <span className="mr-0 h-1.5 w-1.5 rounded-full bg-brand opacity-0 transition-all group-hover:mr-2 group-hover:opacity-100" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <h3 className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink">Contact</h3>
              <div className="mt-4 grid gap-2 rounded-xl border border-brand-line bg-slate-50/80 p-2 sm:space-y-2 sm:p-3">
                <a
                  href="tel:+2290191076093"
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-brand sm:text-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span>+229 01 91 07 60 93</span>
                </a>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Abomey-Calavi%2C%20B%C3%A9nin"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-brand sm:text-sm"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span>Abomey-Calavi, Bénin</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-brand-line pt-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-[10px] font-medium uppercase leading-4 tracking-wide text-slate-500">
            &copy; {new Date().getFullYear()} <span className="font-bold text-brand-ink">Ferme Agro-piscicole Saint André</span>. Tous droits réservés.
          </p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:justify-end" aria-label="Liens juridiques">
            <Link href="/legal/confidentialite" className="transition-colors hover:text-brand">Confidentialité</Link>
            <Link href="/legal/cgu" className="transition-colors hover:text-brand">CGU</Link>
            <Link href="/legal/mentions-legales" className="transition-colors hover:text-brand">Mentions légales</Link>
            <Link href="/legal/cookies" className="transition-colors hover:text-brand">Cookies</Link>
            <Link href="/legal/attestations" className="transition-colors hover:text-brand">Attestations</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
