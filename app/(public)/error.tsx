"use client";

import { AlertCircle, RefreshCcw, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-white px-5 py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[32rem] w-[32rem] rounded-full bg-brand/10 blur-[110px]" />
      </div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-brand-line bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertCircle aria-hidden="true" className="h-10 w-10" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
            <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
            Incident temporaire
          </div>
          <h1 className="text-3xl font-black tracking-tight text-brand-ink md:text-5xl">Une erreur s’est produite</h1>
          <p className="mx-auto max-w-md text-sm font-medium leading-7 text-brand-muted md:text-base">
            La page n’a pas pu être affichée correctement. Réessayez dans quelques instants. Vos données n’ont pas été modifiées.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button onClick={reset} className="h-14 w-full rounded-2xl bg-brand font-black text-white hover:bg-brand-dark">
            <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          <Link
            href="/"
            className="text-xs font-bold text-brand-muted underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
