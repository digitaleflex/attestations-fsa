"use client";

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function VerificationErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const getErrorMessage = () => {
    switch (reason) {
      case "missing-token":
        return "Le jeton de vérification est manquant dans l'URL.";
      case "invalid-token":
        return "Le lien de vérification est invalide ou a expiré (24h).";
      case "user-not-found":
        return "L'utilisateur associé à ce lien n'a pas été trouvé.";
      case "already-verified":
        return "Votre adresse email est déjà vérifiée.";
      default:
        return "Une erreur inattendue est survenue lors de la vérification.";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-xl w-full relative z-10"
    >
      <div className="bg-white/70 backdrop-blur-3xl border border-white p-8 md:p-16 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.05)] text-center space-y-8">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-rose-100 rounded-[2.5rem] md:rounded-[3rem] flex items-center justify-center mx-auto text-rose-600 mb-6">
          <AlertCircle className="w-12 h-12 md:w-16 md:h-16" />
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[0.9] tracking-tight">
            Oops ! <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-600 to-orange-600">
              Erreur.
            </span>
          </h1>
          <p className="text-slate-500 text-base md:text-lg font-medium leading-relaxed max-w-sm mx-auto">
            {getErrorMessage()}
          </p>
        </div>

        <div className="space-y-4 mt-8">
          <Link href="/auth?mode=login">
            <Button className="w-full h-16 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-sm shadow-2xl shadow-slate-200 transition-all duration-500 group/btn">
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 mr-4 transition-transform group-hover/btn:-translate-x-2 shrink-0" />
              Retour à la page de connexion
            </Button>
          </Link>
          
          <Link href="/contact">
            <Button variant="outline" className="w-full h-14 md:h-16 rounded-xl md:rounded-2xl border-slate-200 text-slate-600 font-bold text-xs gap-2">
              <Mail className="w-4 h-4" />
              Contacter le support
            </Button>
          </Link>
        </div>
        
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">
          Ferme Agro-Piscicole Cité St André
        </p>
      </div>
    </motion.div>
  );
}

export default function VerificationErrorPage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-6 pt-24 md:pt-36">
      {/* Decorative Blur Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-rose-100/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-[-10%] w-[50vw] h-[50vw] bg-amber-100/20 rounded-full blur-[100px]" />
      </div>

      <Suspense fallback={<div>Chargement...</div>}>
         <VerificationErrorContent />
      </Suspense>
    </div>
  );
}
