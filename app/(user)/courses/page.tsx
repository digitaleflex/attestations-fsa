"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Video, 
  FileText, 
  Search, 
  Download, 
  PlayCircle, 
  Filter, 
  GraduationCap,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { cn } from "@/lib/utils";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  type: "BOOK" | "VIDEO" | "REVISION_FILE" | "OTHER";
  url: string;
  thumbnail: string | null;
  category: string | null;
  createdAt: string;
}

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const { data: resources, isLoading } = useQuery({
    queryKey: ["user-resources"],
    queryFn: async () => {
      const res = await fetch("/api/resources");
      if (!res.ok) throw new Error("Erreur réseau");
      return res.json() as Promise<Resource[]>;
    },
  });

  const filteredResources = resources?.filter((res) => {
    const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase()) || 
                         res.description?.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "ALL" || res.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "VIDEO": return <Video className="w-5 h-5 text-rose-500" />;
      case "BOOK": return <BookOpen className="w-5 h-5 text-emerald-500" />;
      case "REVISION_FILE": return <FileText className="w-5 h-5 text-blue-500" />;
      default: return <Layers className="w-5 h-5 text-slate-500" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "VIDEO": return "Vidéo de cours";
      case "BOOK": return "Livre / Guide";
      case "REVISION_FILE": return "Fichier de révision";
      default: return "Ressource";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="h-40 rounded-[2rem] bg-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header Mural */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 px-8 py-12 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="max-w-xl">
             <div className="flex items-center gap-2 text-emerald-400 mb-4 animate-bounce">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Excellence FSA</span>
             </div>
             <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-4">
                Bibliothèque de <br/><span className="text-emerald-400">Formation</span>
             </h1>
             <p className="text-slate-400 font-medium text-lg max-w-sm">
                Accédez à tous vos supports pédagogiques pour réussir vos examens certifiants.
             </p>
          </div>
          
          <div className="flex-shrink-0">
             <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex items-center gap-6">
                <div className="text-center">
                    <p className="text-3xl font-black">{resources?.length || 0}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Modules</p>
                </div>
                <div className="w-[1px] h-10 bg-white/20" />
                <div className="text-center">
                    <p className="text-3xl font-black text-emerald-400">{resources?.filter(r => r.type === 'VIDEO').length || 0}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Vidéos</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Barre de Recherche & Filtres */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-xl shadow-slate-200/50">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un cours ou un sujet..."
            className="pl-12 h-12 bg-slate-50 border-none rounded-2xl focus:ring-emerald-500 font-bold"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto scrollbar-hide">
          {[
            { id: "ALL", label: "Tous", icon: Layers },
            { id: "VIDEO", label: "Vidéos", icon: Video },
            { id: "BOOK", label: "Livres", icon: BookOpen },
            { id: "REVISION_FILE", label: "Révision", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0",
                activeTab === tab.id 
                  ? "bg-white text-slate-900 shadow-md" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille de Cours */}
      {!filteredResources || filteredResources.length === 0 ? (
        <Card className="p-20 border-none shadow-2xl shadow-slate-200/50 rounded-[3rem] bg-white flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
            <BookOpen className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Aucune ressource trouvée</h3>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2">
            Essayez de modifier vos filtres ou de chercher un autre sujet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="group relative border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden hover:-translate-y-1 transition-all duration-500 bg-white">
              <div className="aspect-video relative overflow-hidden bg-slate-100">
                {resource.thumbnail ? (
                  <img src={resource.thumbnail} alt={resource.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                    <GraduationCap className="w-16 h-16 text-slate-200" />
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <Badge className="bg-white/90 backdrop-blur-md text-slate-900 border-none shadow-sm flex items-center gap-2 p-1.5 px-3 rounded-full">
                    {getIcon(resource.type)}
                    <span className="text-[10px] font-black uppercase tracking-widest">{getLabel(resource.type)}</span>
                  </Badge>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                   <Badge variant="outline" className="border-emerald-100 text-emerald-600 bg-emerald-50 text-[9px] font-black uppercase tracking-widest">
                      {resource.category || "Général"}
                   </Badge>
                   <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-auto">
                      {new Date(resource.createdAt).toLocaleDateString("fr-FR", { month: 'short', year: 'numeric' })}
                   </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-3 group-hover:text-emerald-600 transition-colors uppercase leading-tight line-clamp-2 min-h-[3.5rem]">
                  {resource.title}
                </h3>
                <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-6">
                  {resource.description || "Consultez cette ressource pour approfondir vos connaissances sur ce module."}
                </p>
                
                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                  {resource.type === 'VIDEO' ? (
                     <a href={resource.url} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button className="w-full bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] transition-all gap-2 group">
                           <PlayCircle className="w-4 h-4" /> Visionner le cours
                        </Button>
                     </a>
                  ) : (
                     <a href={resource.url} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button className="w-full bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-600 rounded-2xl h-12 font-black uppercase tracking-widest text-[10px] transition-all gap-2 group">
                           <Download className="w-4 h-4" /> Télécharger
                        </Button>
                     </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
