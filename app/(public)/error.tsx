"use client";

import { AlertCircle, RefreshCcw, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-slate-50 px-5 py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[32rem] w-[32rem] rounded-full bg-rose-100/70 blur-[110px]" />
        <div className="absolute -bottom-28 -left-20 h-[26rem] w-[26rem] rounded-full bg-brand/10 blur-[100px]" />
      </div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-12 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-amber-400" />
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <AlertCircle aria-hidden="true" className="h-10 w-10" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
            <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
            Incident temporaire
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Une erreur s’est produite</h1>
          <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 md:text-base">
            La page n’a pas pu être affichée correctement. Réessayez dans quelques instants. Vos données n’ont pas été modifiées.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={reset} className="h-14 flex-1 rounded-2xl bg-slate-950 font-black text-white hover:bg-brand-dark">
            <RefreshCcw aria-hidden="true" className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          <Link href="/" className="flex-1">
            <Button variant="outline" className="h-14 w-full rounded-2xl border-slate-200 font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
              <Home aria-hidden="true" className="mr-2 h-4 w-4" />
              Retour à l’accueil
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
