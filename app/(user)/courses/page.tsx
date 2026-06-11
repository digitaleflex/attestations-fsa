"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Video,
  FileText,
  Search,
  Download,
  PlayCircle,
  GraduationCap,
  Layers,
  Sparkles,
  ClipboardList,
  Target
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

export default function HubApprentissagePage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const { data: resources, isLoading } = useQuery({
    queryKey: ["user-resources"],
    queryFn: async () => {
      const res = await fetch("/api/resources");
      if (!res.ok) throw new Error("Erreur rÃ©seau");
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
      case "VIDEO": return "VidÃ©o de cours";
      case "BOOK": return "Livre / Guide";
      case "REVISION_FILE": return "Fichier de rÃ©vision";
      default: return "Ressource";
    }
  };

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
                Hub <span className="text-emerald-400">Apprentissage</span>
             </h1>
             <p className="text-slate-400 font-medium text-lg max-w-sm">
                Votre point d'entrÃ©e unique vers vos cours, vos rÃ©visions et vos sessions d'examens.
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
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">VidÃ©os</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-8 bg-slate-100/50 p-1.5 rounded-[1.5rem]">
          <TabsTrigger value="courses" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md"><BookOpen className="w-4 h-4 mr-2" /> Mes Cours</TabsTrigger>
          <TabsTrigger value="exams" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md"><ClipboardList className="w-4 h-4 mr-2" /> Examens Officiels</TabsTrigger>
          <TabsTrigger value="training" className="rounded-xl font-bold py-3 text-sm sm:text-base data-[state=active]:shadow-md"><Target className="w-4 h-4 mr-2" /> EntraÃ®nement</TabsTrigger>
        </TabsList>
        
        <TabsContent value="courses" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Barre de Recherche & Filtres */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
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
                  { id: "VIDEO", label: "VidÃ©os", icon: Video },
                  { id: "BOOK", label: "Livres", icon: BookOpen },
                  { id: "REVISION_FILE", label: "RÃ©vision", icon: FileText },
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
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
                </div>
            ) : !filteredResources || filteredResources.length === 0 ? (
              <Card className="p-20 border-none shadow-2xl shadow-slate-200/50 rounded-[3rem] bg-white flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                  <BookOpen className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Aucune ressource trouvÃ©e</h3>
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
                            {resource.category || "GÃ©nÃ©ral"}
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
                                <Download className="w-4 h-4" /> TÃ©lÃ©charger
                              </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent value="exams" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-12 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-indigo-100 flex items-center justify-center mb-6 shadow-inner">
              <ClipboardList className="w-12 h-12 text-indigo-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Examens Officiels</h3>
            <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto mb-10">
              Retrouvez ici vos sessions d'examens certifiants, vos convocations et toutes les instructions pour le jour J.
            </p>
            <Link href="/exams">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-14 px-10 font-black uppercase tracking-widest text-xs gap-3 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-1">
                AccÃ©der Ã  mes examens <ClipboardList className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="p-12 border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-gradient-to-br from-amber-50 to-white flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-amber-100 flex items-center justify-center mb-6 shadow-inner">
              <Target className="w-12 h-12 text-amber-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">EntraÃ®nement & Examens Blancs</h3>
            <p className="text-slate-500 text-lg font-medium max-w-lg mx-auto mb-10">
              PrÃ©parez-vous dans les conditions rÃ©elles avec nos examens blancs et quiz d'entraÃ®nement chronomÃ©trÃ©s.
            </p>
            <Link href="/exams">
              <Button className="bg-amber-500 hover:bg-amber-600 text-white rounded-2xl h-14 px-10 font-black uppercase tracking-widest text-xs gap-3 shadow-lg shadow-amber-200 transition-all hover:-translate-y-1">
                Commencer un entraÃ®nement <Target className="w-4 h-4" />
              </Button>
            </Link>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
