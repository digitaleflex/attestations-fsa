"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Video,
  FileText,
  Search,
  ArrowLeft,
  ExternalLink,
  RefreshCcw,
  Library,
  Clock,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

type Resource = {
  id: string;
  title: string;
  description?: string;
  type: "BOOK" | "VIDEO" | "REVISION_FILE" | "OTHER";
  url: string;
  thumbnail?: string;
  category?: string;
  createdAt: string;
};

interface ResourcesClientProps {
    initialResources: Resource[];
}

export default function ResourcesClient({ initialResources }: ResourcesClientProps) {
  const [search, setSearch] = useState("");

  const filtered = initialResources.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden w-full">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white border-b border-slate-100 pb-12 md:pb-24 pt-24 md:pt-36">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10 text-center">
          <div className="flex flex-col items-center space-y-6 md:space-y-8">
            <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className="inline-flex items-center gap-2.5 px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 shadow-sm"
            >
               <Library className="w-3.5 h-3.5 md:w-4 md:h-4" />
               <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em]">Bibliothèque Digitale</span>
            </motion.div>
            
            <div className="space-y-4 px-2">
              <h1 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1] max-w-4xl">
                 Un Savoir <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">Illimité</span> <br className="hidden md:block" /> à portée de main.
              </h1>
              <p className="text-base md:text-xl text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
                Manuels, guides et cours magistraux de la Ferme St André. Accessible partout.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 w-full max-w-md mt-4 px-4">
              <div className="relative flex-1 group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                 <Input
                   placeholder="Rechercher..."
                   className="pl-11 h-12 md:h-14 rounded-xl md:rounded-2xl bg-white border-slate-200 shadow-xl shadow-slate-100/30 w-full font-bold text-slate-800"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
              <Button asChild variant="ghost" className="rounded-xl font-black h-12 md:h-14 text-xs tracking-widest px-6" size="lg">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {filtered.length > 0 ? (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
                show: {
                    transition: {
                        staggerChildren: 0.1
                    }
                }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {filtered.map((res) => (
              <motion.div
                key={res.id}
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 }
                }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                <ResourcePublicCard resource={res} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-20 md:py-24 space-y-6">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-4 border border-slate-50">
              <RefreshCcw className="w-8 h-8 md:w-10 md:h-10 text-slate-200" />
            </div>
            <div className="space-y-2 px-6">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">Aucun résultat trouvé</h2>
              <p className="text-slate-500 text-sm md:text-base font-medium">Réessayez avec un autre mot-clé.</p>
            </div>
            <Button onClick={() => setSearch("")} variant="outline" className="rounded-xl font-bold h-12 px-8">Tout voir</Button>
          </div>
        )}

        {/* Prochainement Section */}
        <div className="mt-16 md:mt-24 p-8 md:p-16 rounded-[2.5rem] md:rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-emerald-500/5 skew-x-12 transform translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-12 text-center md:text-left">
            <div className="space-y-4 md:space-y-6 max-w-xl">
              <Badge className="bg-emerald-500 text-white border-none px-4 py-1 rounded-full font-black uppercase text-[9px] tracking-[0.2em]">Innovation</Badge>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">Vidéothèque HD & Quiz de révision.</h2>
              <p className="text-slate-400 font-medium text-base md:text-lg leading-relaxed px-2 md:px-0 opacity-80">
                Nos ingénieurs préparent des modules immersifs en 4K et des tests interactifs pour vos révisions.
              </p>
              <div className="flex items-center justify-center md:justify-start gap-2 text-[10px] md:text-sm font-black uppercase tracking-widest text-emerald-400 opacity-90">
                <Clock className="w-4 h-4 animate-pulse" /> Bientôt disponible
              </div>
            </div>
            <div className="w-48 h-48 md:w-64 md:h-64 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center rotate-3 transform overflow-hidden relative shadow-2xl shadow-black/20">
                <Sparkles className="w-16 h-16 md:w-24 md:h-24 text-emerald-500/10 animate-pulse" />
                <div className="absolute inset-0 bg-emerald-500/5 animate-shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcePublicCard({ resource }: { resource: Resource }) {
  const Icon = resource.type === 'BOOK' ? BookOpen : resource.type === 'VIDEO' ? Video : FileText;
  const colorMap: any = {
    BOOK: "emerald",
    VIDEO: "blue",
    REVISION_FILE: "rose",
    OTHER: "slate"
  };

  const colors: any = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100"
  };

  const color = colorMap[resource.type] || "slate";

  return (
    <Card className="group relative overflow-hidden border-none shadow-[0_20px_50px_rgba(0,0,0,0.03)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] hover:-translate-y-2 transition-all duration-500 flex flex-col bg-white rounded-[2.5rem] md:rounded-[3rem]">
      {/* Accent Line */}
      <div className={`absolute top-0 left-0 w-2 h-full ${resource.type === 'BOOK' ? 'bg-emerald-500' : resource.type === 'VIDEO' ? 'bg-blue-500' : 'bg-rose-500'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      {/* Visual Area with Glass Effect */}
      <div className="aspect-[16/10] w-full flex items-center justify-center relative overflow-hidden bg-slate-50/50">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full ${colors[color]} flex items-center justify-center group-hover:scale-110 transition-transform duration-700 relative`}>
            <Icon className="w-8 h-8 md:w-10 md:h-10" />
        </div>

        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
           <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-slate-100 px-3 md:px-4 py-1.5 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg">
              {resource.type}
           </Badge>
        </div>
      </div>

      <div className="p-6 md:p-10 space-y-4 md:space-y-6 flex-1 flex flex-col">
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                   {resource.category || "Technique"}
                </div>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors tracking-tight">
                {resource.title}
            </h3>
        </div>

        <p className="text-slate-500 font-medium leading-relaxed line-clamp-3 text-xs md:text-base flex-1">
            {resource.description || "Un guide indispensable pour maîtriser les aspects théoriques et pratiques de ce module spécialisé."}
        </p>

        <div className="pt-2 md:pt-4">
            <Button asChild className="w-full h-14 md:h-16 rounded-xl md:rounded-[1.5rem] bg-slate-900 hover:bg-emerald-600 text-white font-black group shadow-xl hover:shadow-emerald-500/10 transition-all duration-500 text-xs md:text-sm">
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                <span>Accéder</span>
                <ExternalLink className="w-4 h-4 ml-3 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </a>
            </Button>
        </div>
      </div>
    </Card>
  );
}
