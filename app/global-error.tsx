"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, Home, LifeBuoy } from "lucide-react";

/**
 * Filet d'erreur racine (issue #84).
 *
 * Il est nécessaire ici, et pas seulement confortable : `app/admin/layout.tsx`
 * appelle bien des données (`headers()`, puis `auth.api.getSession()`) et
 * monte quatre composants (`AdminSidebar`, `AdminBreadcrumbs`,
 * `AdminCommandPalette`, `NotificationCenter`). Une erreur dans le layout —
 * session illisible, fournisseur d'authentification indisponible, composant de
 * la coquille en panne — se produit AU-DESSUS de `app/admin/error.tsx` : cette
 * boundary ne l'attrape pas, l'erreur remonte jusqu'ici. Sans ce fichier,
 * l'administrateur landing sur cette erreur voit la page d'erreur brute de
 * Next.js, en pleine navigation.
 *
 * Contraintes propres à `global-error` :
 *  - il remplace le layout racine, donc il doit rendre `<html>` et `<body>`
 *    lui-même — pas d'import du layout, pas de police de marque ;
 *  - les couleurs de fond et de texte sont posées en `style` inline en plus des
 *    classes, pour que l'écran reste lisible même si la feuille de style n'a pas
 *    encore été appliquée sur ce chemin ;
 *  - même règle de copie qu'ailleurs : aucun détail technique en production, un
 *    bouton pour réessayer, un lien pour sortir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error] Erreur non interceptée", error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <html lang="fr">
      <body
        className="font-sans antialiased"
        style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
      >
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-24 h-[30rem] w-[30rem] rounded-full bg-rose-100/70 blur-[110px]" />
            <div className="absolute -bottom-28 -left-20 h-[24rem] w-[24rem] rounded-full bg-brand/10 blur-[100px]" />
          </div>

          <section
            role="alert"
            className="relative w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-12 animate-fade-in-up"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-amber-400" />
            <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <AlertCircle aria-hidden="true" className="h-10 w-10" />
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
                <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
                Incident temporaire
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Le site n’a pas pu être affiché
              </h1>
              <p className="mx-auto max-w-lg text-sm font-medium leading-7 text-slate-600 md:text-base">
                L’erreur est survenue avant l’affichage de la page. Aucune
                donnée n’a été modifiée. Relancez le chargement, ou revenez à
                l’accueil pour reprendre depuis le début.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl bg-slate-950 px-6 font-black text-white shadow-lg transition-all hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
                Réessayer
              </button>
              <a
                href="/"
                className="inline-flex h-14 flex-1 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Home aria-hidden="true" className="mr-2 h-4 w-4" />
                Retour à l’accueil
              </a>
            </div>

            {isDev && (error.message || error.digest) ? (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Détail technique (développement)
                </summary>
                <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                  {error.message ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">
                      {error.message}
                    </pre>
                  ) : null}
                  {error.digest ? (
                    <p className="font-mono">
                      Référence de suivi : {error.digest}
                    </p>
                  ) : null}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </body>
    </html>
  );
}
