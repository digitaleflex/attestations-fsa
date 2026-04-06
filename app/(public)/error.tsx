"use client";

import * as React from "react";

import { AlertCircle, RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6 bg-white rounded-3xl p-8 shadow-xl border border-rose-100">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Une erreur s'est produite</h1>
        <p className="text-slate-500 text-sm">
          Le système a rencontré une difficulté technique inattendue.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => reset()} className="gap-2 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700">
            <RefreshCcw className="w-4 h-4" />
            Réessayer
          </Button>
          <Link href="/">
            <Button variant="ghost" className="gap-2 h-12 rounded-2xl w-full text-slate-500">
              <Home className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
