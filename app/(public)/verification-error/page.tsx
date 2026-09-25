import type { Metadata } from "next";
import { motion } from "framer-motion";
import { AlertCircle, Mail, ArrowLeft, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vérification impossible",
  description: "Votre adresse email FSA n’a pas pu être vérifiée.",
};

function getErrorMessage(reason?: string) {
  switch (reason) {
    case "missing-token":
      return "Le jeton de vérification est absent du lien que vous avez ouvert.";
    case "invalid-token":
      return "Ce lien de vérification n’est plus valide ou a expiré. Demandez-en un nouveau depuis votre compte.";
    case "user-not-found":
      return "Nous n’avons pas trouvé de compte associé à ce lien de vérification.";
    case "already-verified":
      return "Cette adresse email est déjà vérifiée. Vous pouvez vous connecter normalement.";
    default:
      return "Une difficulté inattendue a empêché la vérification de votre adresse email.";
  }
}

export default async function VerificationErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const alreadyVerified = reason === "already-verified";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[34rem] w-[34rem] rounded-full bg-rose-100/70 blur-[110px]" />
        <div className="absolute -bottom-28 -left-20 h-[28rem] w-[28rem] rounded-full bg-amber-100/50 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-xl"
      >
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-12">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-amber-400" />
          <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
            <AlertCircle aria-hidden="true" className="h-10 w-10" />
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">
              <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
              Vérification interrompue
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              {alreadyVerified ? "Déjà vérifié" : "Vérification impossible"}
            </h1>
            <p className="mx-auto max-w-md text-sm font-medium leading-7 text-slate-500 md:text-base">
              {getErrorMessage(reason)}
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <Link href="/auth?mode=login">
              <Button className="h-14 w-full rounded-2xl bg-slate-950 font-black text-white hover:bg-slate-800">
                <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                {alreadyVerified ? "Se connecter" : "Retour à la connexion"}
              </Button>
            </Link>
            {!alreadyVerified && (
              <Link href="/contact">
                <Button variant="outline" className="h-14 w-full rounded-2xl border-slate-200 font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                  <Mail aria-hidden="true" className="mr-2 h-4 w-4" />
                  Contacter le support
                </Button>
              </Link>
            )}
          </div>

          <p className="mt-8 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
            Ferme Agro-Piscicole Cité St André
          </p>
        </section>
      </motion.div>
    </main>
  );
}
