import type { Metadata } from "next";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Adresse email confirmée",
  description: "Votre adresse email FSA a été vérifiée avec succès.",
};

export default function VerificationSuccessPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[34rem] w-[34rem] rounded-full bg-emerald-100/70 blur-[110px]" />
        <div className="absolute -bottom-28 -left-20 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-xl w-full relative z-10"
      >
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-14">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-brand to-emerald-400" />
          <div className="relative">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-brand/10 rounded-[2.5rem] md:rounded-[3rem] flex items-center justify-center mx-auto text-brand mb-6">
              <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16" />
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-1/4"
            >
              <Sparkles className="w-6 h-6 text-brand/60 opacity-50" />
            </motion.div>
          </div>

          <div className="space-y-4 pt-3">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[0.9] tracking-tight">
              Email <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-dark">
                Confirmé.
              </span>
            </h1>
            <p className="text-slate-500 text-base md:text-lg font-medium leading-relaxed max-w-sm mx-auto">
              Votre adresse email a été vérifiée avec succès. Votre compte est désormais pleinement sécurisé.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4 text-left">
            <ShieldCheck className="w-8 h-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Sécurité Active</p>
              <p className="text-sm font-bold text-slate-700">Votre profil est certifié authentique.</p>
            </div>
          </div>

          <Link href="/auth?mode=login">
            <Button className="w-full h-16 mt-2 rounded-2xl bg-slate-950 hover:bg-brand-dark text-white font-black uppercase tracking-[0.15em] text-[10px] md:text-xs shadow-xl shadow-brand/10 transition-all duration-500 group/btn">
              Me connecter
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-4 transition-transform group-hover/btn:translate-x-2 shrink-0" />
            </Button>
          </Link>
          
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">
            Ferme Agro-Piscicole Cité St André
          </p>
        </div>
      </motion.div>
    </main>
  );
}
