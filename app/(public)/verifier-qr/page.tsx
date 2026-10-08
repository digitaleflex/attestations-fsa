import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Vérification par QR code",
  description: "Vérifiez une attestation FSA à l’aide de son code unique.",
};

export default function VerifierQrPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-5 py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[34rem] w-[34rem] rounded-full bg-brand/10 blur-[110px]" />
      </div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-brand-line bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] md:p-12 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand" />
        <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-brand-line/40 text-brand-ink ring-1 ring-brand-line">
          <QrCode aria-hidden="true" className="h-10 w-10" />
        </div>

        <div className="mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-line/40 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">
            <ScanLine aria-hidden="true" className="h-3.5 w-3.5" />
            État du service : scan désactivé
          </div>
          <h1 className="text-3xl font-black tracking-tight text-brand-ink md:text-5xl">Le scan QR n’est pas disponible</h1>
          <p className="mx-auto max-w-md text-sm font-medium leading-7 text-brand-muted md:text-base">
            La lecture du QR code est désactivée pour le moment. Vous pouvez toujours vérifier une attestation gratuitement avec son code unique.
          </p>
        </div>

        <div className="rounded-2xl border border-brand-line bg-brand-line/30 p-5 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted">Solution disponible</p>
          <p className="mt-1 font-bold text-brand-ink">Saisissez le code imprimé sur l’attestation.</p>
        </div>

        <div className="mt-7 flex flex-col items-center gap-3">
          <Link href="/verifier" className="w-full">
            <Button className="h-14 w-full rounded-2xl bg-brand font-black text-white hover:bg-brand-dark">
              <KeyRound aria-hidden="true" className="mr-2 h-4 w-4" />
              Vérifier par code
            </Button>
          </Link>
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
