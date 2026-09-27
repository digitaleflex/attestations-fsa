"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, LayoutDashboard, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Filet d'erreur du segment `/admin` (issue #84).
 *
 * Elle rattrape les erreurs de rendu des pages d'administration — la plus
 * exposée étant `app/admin/dashboard/page.tsx`, qui lit six compteurs en base.
 * Le filet est donc utile, mais il ne doit pas devenir l'écran normal : la page
 * du tableau de bord gère elle-même les compteurs qui échouent, et ne laisse
 * remonter une erreur que lorsque plus rien n'est lisible.
 *
 * Règles de copie tenues ici :
 *  - message sobre et factuel, sans nom de table, sans nom de champ, sans
 *    détail d'infrastructure, en production comme en développement ;
 *  - le détail technique (message d'erreur, référence de suivi) reste visible
 *    en développement uniquement, pour le développeur — jamais pour l'admin en
 *    production ;
 *  - une action utile est toujours proposée : réessayer, ou revenir à la
 *    console si l'écran d'erreur est lui-même dans une impasse.
 *
 * Le rendu reprend la composition de `app/(public)/error.tsx` (halo diffus,
 * carte blanche très arrondie, filet de couleur en tête, pastille d'icône,
 * badge discret, deux boutons de 56 px) pour que les deux erreurs de
 * l'application se ressemblent — sans le `<main>` ni le plein écran : ici, le
 * `<main id="contenu-principal">` du layout admin entoure déjà le contenu.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Journalisé dans la console du navigateur : sans impact sur ce qui est
  // affiché, et l'administrateur peut transmettre la référence de suivi.
  useEffect(() => {
    console.error("[admin] Erreur non interceptée dans l'administration", error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="relative flex min-h-full items-center justify-center bg-slate-50 px-5 py-14 md:py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[28rem] w-[28rem] rounded-full bg-rose-100/70 blur-[110px]" />
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
            Impossible de charger cette page
          </h1>
          <p className="mx-auto max-w-lg text-sm font-medium leading-7 text-slate-600 md:text-base">
            Les données de cette page n’ont pas pu être récupérées. Aucune
            donnée n’a été modifiée. Relancez le chargement, ou revenez à la
            console pour travailler sur une autre section.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={reset}
            className="h-14 flex-1 rounded-2xl bg-slate-950 font-black text-white hover:bg-brand-dark"
          >
            <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          <Button variant="outline" asChild className="h-14 flex-1 rounded-2xl border-slate-200 font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
            <Link href="/admin/dashboard">
              <LayoutDashboard aria-hidden="true" className="mr-2 h-4 w-4" />
              Retour à la console
            </Link>
          </Button>
        </div>

        {/* Détail technique : développement uniquement. En production, ce bloc
            est retiré du bundle (NEXT_PUBLIC-free, l'inliner remplace la
            condition par `false`). Aucune fuite de message d'erreur, de nom de
            table ni de stack en production. */}
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
                <p className="font-mono">Référence de suivi : {error.digest}</p>
              ) : null}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
