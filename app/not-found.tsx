import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-black text-emerald-600">404</div>
        <h1 className="text-2xl font-bold text-slate-900">Page introuvable</h1>
        <p className="text-slate-500 text-sm">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
