"use client";

import React, { useEffect, useState } from "react";
import { 
  BookOpen, 
  Video, 
  FileText, 
  Download, 
  Search, 
  ArrowRight,
  Sparkles,
  Library,
  Clock,
  ArrowLeft,
  ExternalLink,
  RefreshCcw,
  Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Input } from "@/components/ui/input";

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

export default function RessourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRessources = async () => {
      try {
        const res = await fetch("/api/resources");
        if (!res.ok) throw new Error("Erreur de chargement");
        const data = await res.json();
        setResources(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRessources();
  }, []);

  const filtered = resources.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.category?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white border-b border-slate-100 py-16 md:py-24">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex items-center gap-2 text-emerald-600">
               <Library className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Espace Apprentissage</span>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                Bibliothèque <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600 italic">Digitale</span> FSA
              </h1>
              <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                Accédez à tous nos supports de cours officiels, fiches de révision et tutoriels vidéo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-lg mt-4">
              <div className="relative w-full group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                 <Input 
                   placeholder="Rechercher un cours, un manuel..." 
                   className="pl-12 h-14 rounded-2xl bg-white border-slate-200 shadow-xl shadow-slate-100/50 w-full"
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                 />
              </div>
              <Button asChild variant="ghost" className="rounded-xl font-bold h-14" size="lg">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-[2.5rem] bg-white animate-pulse shadow-sm" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map(res => (
              <ResourcePublicCard key={res.id} resource={res} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24 space-y-6">
            <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto mb-4 border border-slate-50">
              <RefreshCcw className="w-10 h-10 text-slate-200" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Aucune ressource trouvée</h2>
              <p className="text-slate-500 font-medium">Revenez bientôt, nous ajoutons régulièrement de nouveaux contenus.</p>
            </div>
            <Button onClick={() => setSearch("")} variant="outline" className="rounded-xl font-bold">Voir tout</Button>
          </div>
        )}

        {/* Prochainement Section */}
        <div className="mt-24 p-10 md:p-16 rounded-[3rem] bg-slate-900 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-emerald-500/10 skew-x-12 transform translate-x-1/2" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="space-y-6 max-w-xl text-center md:text-left">
              <Badge className="bg-emerald-500 text-white border-none px-4 py-1 rounded-full font-black uppercase text-[10px] tracking-widest">Innovation</Badge>
              <h2 className="text-4xl font-black tracking-tight leading-tight">Vidéothèque HD et Quiz de révision en préparation.</h2>
              <p className="text-slate-400 font-medium text-lg leading-relaxed">
                Nous travaillons sur une série de vidéos immersives en 4K sur le terrain et des modules interactifs pour tester vos connaissances.
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <Clock className="w-4 h-4" /> Bientôt disponible
                </div>
              </div>
            </div>
            <div className="w-64 h-64 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center rotate-3 scale-110 overflow-hidden relative">
                <Sparkles className="w-24 h-24 text-emerald-500/20 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-12 h-1 bg-emerald-500 rounded-full animate-shimmer" />
                </div>
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
    <Card className="group overflow-hidden border-none shadow-xl hover:-translate-y-2 transition-all duration-500 flex flex-col bg-white rounded-[2.5rem]">
      {/* Visual Area */}
      <div className={`aspect-video w-full flex items-center justify-center relative overflow-hidden bg-slate-50`}>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
        <Icon className="w-16 h-16 text-slate-200 transition-all duration-700 group-hover:scale-125 group-hover:rotate-6" />
        
        <div className="absolute bottom-6 left-6 z-20 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
          <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
             {resource.type}
          </Badge>
        </div>
      </div>

      <div className="p-8 space-y-6 flex-1 flex flex-col">
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Tag className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{resource.category || "FSA"}</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-emerald-600 transition-colors">
                {resource.title}
            </h3>
        </div>

        <p className="text-slate-500 font-medium leading-relaxed line-clamp-3 text-sm flex-1 italic">
            "{resource.description || "Consultez cet ouvrage de référence pour approfondir vos connaissances techniques sur le terrain."}"
        </p>

        <Button asChild className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-black group shadow-xl shadow-slate-100 transition-all">
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            Ouvrir la ressource
            <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </a>
        </Button>
      </div>
    </Card>
  );
}
