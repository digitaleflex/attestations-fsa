"use client";

import React from "react";
import { 
  Users, 
  Search, 
  MapPin, 
  ExternalLink, 
  ArrowRight,
  UserCheck,
  Globe,
  Award,
  Sparkles,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export default function PortfoliosListPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero */}
      <div className="bg-white border-b border-slate-100 py-20 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-50 rounded-full blur-3xl -mr-64 -mt-64 opacity-50" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center space-y-8">
           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-1.5 rounded-full font-black uppercase tracking-widest text-[10px] animate-pulse">
              💎 Excellence FSA
            </Badge>
           <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-tight">
             Découvrez nos <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 italic">Talents</span>
           </h1>
           <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto">
             L'annuaire officiel des diplômés et techniciens certifiés de la Ferme Agro-Piscicole St André.
           </p>

           <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                <Input 
                  placeholder="Rechercher un technicien, une promo..." 
                  className="pl-12 w-[340px] rounded-2xl h-14 bg-white border-slate-200 shadow-xl shadow-slate-100/50"
                />
              </div>
              <Button asChild size="lg" className="rounded-2xl h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold group">
                <Link href="/">
                    <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Accueil
                </Link>
              </Button>
           </div>
        </div>
      </div>

      {/* Grid Coming Soon */}
      <div className="max-w-7xl mx-auto px-6 py-20 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {[1,2,3,4,5,6].map((i) => (
             <div key={i} className="opacity-40 grayscale pointer-events-none blur-[1px]">
               <Card className="p-6 rounded-[2rem] border-none shadow-xl bg-white space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-3/4 bg-slate-100 rounded-full animate-pulse" />
                      <div className="h-3 w-1/2 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-50 space-y-2">
                     <div className="h-3 w-full bg-slate-50 rounded-full" />
                     <div className="h-3 w-2/3 bg-slate-50 rounded-full" />
                  </div>
               </Card>
             </div>
           ))}
        </div>

        {/* Overlay Coming Soon */}
        <div className="absolute inset-x-0 bottom-0 top-40 bg-gradient-to-t from-slate-50/90 to-transparent flex items-center justify-center pb-20">
           <div className="bg-white/80 backdrop-blur-2xl p-10 md:p-16 rounded-[3rem] border border-white shadow-2xl text-center max-w-2xl mx-6 space-y-8 animate-in zoom-in duration-700">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-200">
                 <Globe className="w-10 h-10 animate-spin-slow" />
              </div>
              <div className="space-y-4">
                 <h2 className="text-4xl font-black text-slate-900 tracking-tight">Portfolios en construction</h2>
                 <p className="text-slate-500 text-lg font-medium leading-relaxed">
                   Dès Mai 2026, chaque diplômé de la FSA disposera d'un portfolio public vérifié 
                   mettant en avant ses compétences, ses projets et ses certifications officielles.
                 </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                 <PortfolioFeature icon={Award} label="Certification" />
                 <PortfolioFeature icon={UserCheck} label="Vérifié" />
                 <PortfolioFeature icon={Sparkles} label="Projets" />
              </div>
              <Button className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg shadow-xl shadow-slate-200">
                Me prévenir du lancement
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioFeature({ icon: Icon, label }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
       <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
          <Icon className="w-6 h-6" />
       </div>
       <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
    </div>
  );
}
