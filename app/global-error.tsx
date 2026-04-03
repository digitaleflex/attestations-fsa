"use client";

import { useEffect } from "react";
import * as React from "react";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    // Log de l'erreur dans la console pour le debug (Expert practice)
    console.error("Critical Runtime Error:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="max-w-md w-full p-8 text-center bg-white rounded-[2.5rem] shadow-2xl border border-rose-100 flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
             <AlertCircle className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 uppercase italic">Oups ! Une erreur s'est produite.</h1>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Le système a rencontré une difficulté technique inattendue. Nos équipes sont sur le coup.
            </p>
          </div>

          <div className="grid grid-cols-1 w-full gap-3">
            <Button 
                onClick={() => reset()} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2 h-12 rounded-2xl shadow-lg"
            >
                <RefreshCcw className="w-4 h-4" />
                Tenter de recharger la page
            </Button>
            
            <Link href="/" className="w-full">
                <Button variant="ghost" className="w-full gap-2 h-12 rounded-2xl text-slate-500 italic">
                    <Home className="w-4 h-4" />
                    Retour à l'accueil
                </Button>
            </Link>
          </div>
          
          <p className="text-[10px] text-slate-300 uppercase font-bold tracking-widest mt-4 italic">
            Portail Officiel • Cité St André
          </p>
        </div>
      </body>
    </html>
  );
} 