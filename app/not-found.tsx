import Link from "next/link";

const parcours = [
  { href: "/", label: "Accueil" },
  { href: "/formations", label: "Formations" },
  { href: "/examens", label: "Examens" },
  { href: "/verifier", label: "Vérifier une attestation" },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center space-y-6 max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-brand">
          FSA — Ferme Agro-Piscicole St André
        </p>
        <div className="text-8xl font-black text-brand">404</div>
        <h1 className="text-2xl font-bold text-brand-ink">Page introuvable</h1>
        <p className="text-brand-muted text-sm">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <nav aria-label="Parcours principaux" className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {parcours.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-brand-line bg-white text-brand-ink font-bold text-sm transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
