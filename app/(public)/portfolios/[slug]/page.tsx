"use client";

import React from "react";
import { 
  User, 
  ArrowLeft, 
  Globe, 
  MapPin, 
  Award, 
  Calendar, 
  Mail,
  ShieldCheck,
  Zap,
  Sparkles,
  Search,
  ExternalLink,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { use } from "react";

export default function PortfolioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Dynamic Background */}
      <div className="h-64 md:h-80 w-full bg-slate-900 overflow-hidden relative">
         <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-950" />
         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
         <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-50/50 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-32 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Sidebar / Profile Card */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-8 rounded-[3rem] border-none shadow-2xl bg-white text-center relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
               
               <div className="relative inline-block mx-auto mb-6">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 flex items-center justify-center border-4 border-white shadow-xl overflow-hidden relative">
                     <User className="w-16 h-16 text-slate-300" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg border-2 border-white">
                     <ShieldCheck className="w-5 h-5" />
                  </div>
               </div>

               <div className="space-y-2">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Technicien FSA</h1>
                  <Badge className="bg-slate-50 text-slate-500 font-bold px-4 py-1 rounded-full uppercase text-[10px] tracking-widest border-slate-100 italic">
                     ID: {resolvedParams.slug.toUpperCase()}
                  </Badge>
               </div>

               <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-3xl bg-slate-50 space-y-1">
                     <span className="block text-[10px] font-black uppercase text-slate-400">Certifié</span>
                     <span className="block font-bold text-slate-900 text-xs">Pisciculture</span>
                  </div>
                  <div className="p-4 rounded-3xl bg-slate-50 space-y-1">
                     <span className="block text-[10px] font-black uppercase text-slate-400">Promotion</span>
                     <span className="block font-bold text-slate-900 text-xs">2024-2025</span>
                  </div>
               </div>

               <div className="mt-8 space-y-4">
                  <Button disabled className="w-full h-14 rounded-2xl bg-slate-100 text-slate-400 font-bold border-none shadow-none">
                     <Mail className="w-4 h-4 mr-2" /> Contacter
                  </Button>
               </div>
            </Card>

            <Card className="p-8 rounded-[3rem] border-none shadow-xl bg-slate-900 text-white relative overflow-hidden">
               <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-2 text-emerald-400">
                     <QrCode className="w-5 h-5" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Preuve FSA</span>
                  </div>
                  <h3 className="text-xl font-bold">Certification Vérifiée</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                     Bientôt, ce badge contiendra un lien QR Code unique permettant à quiconque de vérifier instantanément l'attestation de ce technicien.
                  </p>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                     <div className="w-3/4 h-full bg-emerald-500 animate-shimmer" />
                  </div>
               </div>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-10">
            {/* "Coming Soon" Message Card */}
            <div className="p-10 md:p-16 rounded-[4rem] bg-white shadow-2xl relative overflow-hidden border border-slate-100">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10 space-y-8">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                         <Sparkles className="w-6 h-6 animate-pulse" />
                      </div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        Un espace pour valoriser <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 italic">votre parcours.</span>
                      </h2>
                   </div>

                   <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl">
                     Nous créons un espace où chaque diplômé FSA pourra exposer ses projets, ses notations d'examens et ses expériences en ferme.
                   </p>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                      <FeatureItem 
                        icon={Award}
                        title="Certifications"
                        desc="Vos diplômes officiels FSA avec validation blockchain-ready."
                      />
                      <FeatureItem 
                        icon={Zap}
                        title="Compétences"
                        desc="Mise en avant graphique de vos expertises techniques."
                      />
                      <FeatureItem 
                        icon={Globe}
                        title="Visibilité"
                        desc="Partagez votre lien de portfolio aux recruteurs du monde entier."
                      />
                      <FeatureItem 
                        icon={MapPin}
                        title="Réseau FSA"
                        desc="Rejoignez la communauté exclusive des experts St André."
                      />
                   </div>

                   <div className="pt-10 flex gap-4 mt-4 border-t border-slate-100">
                      <Button asChild size="lg" className="rounded-2xl h-14 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold group">
                        <Link href="/portfolios">
                           <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                           Retour à l'annuaire
                        </Link>
                      </Button>
                   </div>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-20" />
    </div>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex gap-4 p-6 rounded-3xl bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 border border-transparent hover:border-slate-100 group">
       <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-all group-hover:rotate-6">
          <Icon className="w-6 h-6" />
       </div>
       <div className="space-y-1">
          <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">{title}</h4>
          <p className="text-slate-500 text-sm font-medium leading-normal">{desc}</p>
       </div>
    </div>
  );
}
