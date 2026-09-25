import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Accès refusé",
  description: "Vous ne disposez pas des autorisations nécessaires pour accéder à cette page.",
};

export default function UnauthorizedPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[34rem] w-[34rem] rounded-full bg-rose-100/70 blur-[110px]" />
        <div className="absolute -bottom-28 -left-20 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-[100px]" />
      </div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-12 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-brand" />
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <ShieldAlert aria-hidden="true" className="h-10 w-10" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
            <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
            Accès protégé
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Accès refusé</h1>
          <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 md:text-base">
            Votre compte ne possède pas les autorisations nécessaires pour consulter cette page. Utilisez le compte correspondant à votre espace.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vous pensez qu’il s’agit d’une erreur ?</p>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-800">Contactez le support avec l’adresse email associée à votre compte.</p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/admin/login" className="flex-1">
            <Button className="h-14 w-full rounded-2xl bg-slate-950 font-black text-white hover:bg-brand-dark">Connexion administrateur</Button>
          </Link>
          <Link href="/contact" className="flex-1">
            <Button variant="outline" className="h-14 w-full rounded-2xl border-slate-200 font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50">Contacter le support</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
