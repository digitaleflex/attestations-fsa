"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VerificationSuccessPage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-6 pt-24 md:pt-36">
      {/* Decorative Blur Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-brand/10/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-[-10%] w-[50vw] h-[50vw] bg-blue-100/20 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-xl w-full relative z-10"
      >
        <div className="bg-white/70 backdrop-blur-3xl border border-white p-8 md:p-16 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.05)] text-center space-y-8">
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

          <div className="space-y-4">
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

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100/50 flex items-center gap-4 text-left">
            <ShieldCheck className="w-8 h-8 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Sécurité Active</p>
              <p className="text-sm font-bold text-slate-700">Votre profil est certifié authentique.</p>
            </div>
          </div>

          <Link href="/auth?mode=login">
            <Button className="w-full h-16 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-900 hover:bg-brand text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-sm shadow-2xl shadow-brand/20 transition-all duration-500 group/btn mt-8">
              Me connecter
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-4 transition-transform group-hover/btn:translate-x-2 shrink-0" />
            </Button>
          </Link>
          
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">
            Ferme Agro-Piscicole Cité St André
          </p>
        </div>
      </motion.div>
    </div>
  );
}
