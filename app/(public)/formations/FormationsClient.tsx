"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Search, 
  ArrowRight, 
  CheckCircle, 
  Sparkles,
  Target,
  Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface Formation {
  id: string;
  name: string;
  category: string;
  description: string;
  skills: string[];
}

interface FormationsClientProps {
  initialFormations: Formation[];
}

// Adapter l'accent visuel à la spécialité sans modifier les informations du catalogue.
const getCategoryStyle = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes("pisciculture") || cat.includes("aqua")) {
    return {
      bg: "bg-brand/10 text-brand-dark border-brand/20",
      accent: "text-blue-500",
      cardBg: "from-blue-500/[0.015] to-transparent",
      badge: "bg-blue-100 text-blue-800",
      btnHover: "hover:bg-brand-dark hover:shadow-lg hover:shadow-brand/20"
    };
  }
  if (cat.includes("agri") || cat.includes("mara")) {
    return {
      bg: "bg-brand/10 text-brand-dark border-brand/20",
      accent: "text-brand",
      cardBg: "from-brand/[0.015] to-transparent",
      badge: "bg-brand/10 text-brand-dark",
      btnHover: "hover:bg-brand-dark hover:shadow-lg hover:shadow-brand/20"
    };
  }
  if (cat.includes("elevage") || cat.includes("élevage") || cat.includes("avi")) {
    return {
      bg: "bg-amber-50/80 text-amber-700 border-amber-100/50",
      accent: "text-amber-500",
      cardBg: "from-amber-500/[0.015] to-transparent",
      badge: "bg-amber-100 text-amber-800",
      btnHover: "hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/20"
    };
  }
  return {
    bg: "bg-slate-50/80 text-slate-700 border-slate-100/50",
    accent: "text-brand",
    cardBg: "from-slate-500/[0.015] to-transparent",
    badge: "bg-slate-100 text-slate-800",
    btnHover: "hover:bg-brand-dark hover:shadow-lg hover:shadow-brand/20"
  };
};

export default function FormationsClient({ initialFormations }: FormationsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const categories = ["Toutes", ...Array.from(new Set(initialFormations.map(f => f.category)))];

  const filteredFormations = initialFormations.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         f.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "Toutes" || f.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#fafbfc] selection:bg-brand selection:text-white pb-24 overflow-x-hidden w-full font-sans">
      
      {/* Arrière-plan épuré */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-brand/[0.02] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-blue-500/[0.015] rounded-full blur-[120px]" />
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 md:pt-32 pb-8 px-4 md:px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center space-y-6"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] text-brand">
               <Sparkles className="w-4 h-4 fill-brand" />
               <span className="text-[10px] font-black uppercase tracking-[0.25em]">Excellence FSA</span>
            </div>
            
            <h1 className="max-w-4xl text-4xl font-black leading-[0.98] tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
              Choisissez une formation pour <br className="hidden sm:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand via-brand-dark to-brand-dark">
                développer vos compétences.
              </span>
            </h1>

            <p className="max-w-2xl px-4 text-sm font-medium leading-relaxed text-slate-600 md:text-base">
              Comparez les domaines et les compétences annoncés, puis envoyez une
              demande de préinscription à l’équipe FSA.
            </p>

            {/* Recherche et filtres */}
            <div className="w-full max-w-xl mx-auto pt-6 px-2 md:px-0">
              <div
                role="search"
                aria-labelledby="formation-search-label"
                className="bg-white rounded-2xl border border-slate-300 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition-all duration-300"
              >
                <label id="formation-search-label" htmlFor="formation-search" className="sr-only">
                  Rechercher une formation ou une compétence
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Search className="w-5 h-5 text-slate-600 absolute left-4" aria-hidden="true" />
                    <Input
                      ref={searchInputRef}
                      id="formation-search"
                      type="search"
                      placeholder="Rechercher une formation ou une compétence..."
                      aria-describedby="formation-search-results"
                      aria-controls="formations-results"
                      aria-keyshortcuts="Control+K Meta+K"
                      className="w-full h-12 pl-12 pr-4 bg-transparent border-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset text-base font-bold tracking-wide text-slate-900 placeholder:text-slate-500 placeholder:font-normal"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <fieldset className="mt-6">
                <legend className="sr-only">Filtrer les formations par spécialité</legend>
                <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-3 pt-1 px-1 scrollbar-none w-full">
                  {categories.map((cat) => {
                    const isActive = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap border transition-all duration-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                          isActive
                            ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-950/10 scale-105"
                            : "bg-white text-slate-700 border-slate-300 hover:text-slate-950 hover:border-slate-400 shadow-sm"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- FORMATIONS GRID --- */}
      <section id="formations-results" className="relative z-10 max-w-7xl mx-auto px-4 mt-8 pb-20 md:px-6" aria-labelledby="formations-results-title">
        <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-brand/15 bg-brand/5 px-5 py-4 text-center">
          <h2 id="formations-results-title" className="text-base font-black text-brand-ink">
            La préinscription exprime votre intérêt
          </h2>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
            L’envoi du formulaire transmet votre demande. Il ne confirme pas à lui
            seul l’inscription ni les modalités de la formation.
          </p>
        </div>
        <p id="formation-search-results" role="status" aria-live="polite" className="mb-6 text-center text-sm font-semibold text-slate-700">
          {filteredFormations.length} {filteredFormations.length > 1 ? "formations trouvées" : "formation trouvée"}
          {activeCategory !== "Toutes" ? ` dans la catégorie ${activeCategory}` : ""}
          {searchTerm ? ` pour « ${searchTerm} »` : ""}.
        </p>
        <AnimatePresence mode="popLayout">
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {filteredFormations.map((f, idx) => {
              const style = getCategoryStyle(f.category);
              
              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                  transition={{ 
                    duration: 0.4, 
                    delay: idx * 0.05,
                    ease: "easeOut"
                  }}
                  className="group"
                >
                  <Card className={`h-full relative flex flex-col p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.015)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-500 overflow-hidden bg-gradient-to-br ${style.cardBg}`}>
                    
                    {/* Badge catégorie */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 relative z-10">
                      <Badge variant="outline" className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border-none ${style.bg}`}>
                        {f.category}
                      </Badge>
                    </div>
                    
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-3 tracking-tight leading-snug relative z-10">
                      {f.name}
                    </h3>
                    
                    <p className="text-slate-600 text-sm font-medium leading-relaxed mb-6 line-clamp-3 relative z-10">
                      {f.description}
                    </p>

                    <div className="relative z-10 mb-6 flex w-fit items-center gap-2 rounded-xl border border-slate-100/50 bg-slate-50/50 p-3">
                      <Activity className="h-4 w-4 text-brand" aria-hidden="true" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Compétences annoncées
                      </span>
                    </div>

                    {/* Compétences clés */}
                    <div className="grid grid-cols-1 gap-3 mb-8 relative z-10">
                      {f.skills.slice(0, 3).map((skill, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-3.5 group/skill">
                          <div className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center bg-slate-50/50 border border-slate-100 group-hover/skill:${style.bg} transition-colors duration-300`}>
                             <CheckCircle className="w-3.5 h-3.5 text-slate-500 group-hover/skill:text-slate-700 transition-colors duration-300" />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 group-hover/skill:text-slate-900 transition-colors duration-300">{skill}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bouton d'action */}
                    <div className="mt-auto relative z-10">
                      <Button asChild className={`min-h-14 w-full gap-2 rounded-2xl bg-slate-900 py-3 font-black text-white shadow-lg shadow-slate-100 transition-all duration-500 hover:text-white group/btn active:scale-[0.98] focus-visible:ring-offset-2 ${style.btnHover}`}>
                        <Link href={`/formations/inscription?formationId=${f.id}`}>
                          <span className="text-left leading-snug">Préinscription — {f.name}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover/btn:translate-x-1.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Empty State */}
        {filteredFormations.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 rounded-[3rem] bg-white border border-dashed border-slate-200 shadow-sm"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Aucune spécialité trouvée</h3>
            <p className="text-slate-600 max-w-sm mx-auto font-medium text-sm">Recherchez avec d'autres termes ou parcourez une autre catégorie.</p>
            <Button 
                variant="link" 
                className="mt-6 text-brand font-bold hover:text-brand-dark transition-all text-sm"
                onClick={() => {setSearchTerm(""); setActiveCategory("Toutes");}}
            >
              Réinitialiser la recherche
            </Button>
          </motion.div>
        )}
      </section>



      {/* Styles additionnels */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        /* Masquer la scrollbar pour les navigateurs WebKit */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        /* Masquer la scrollbar pour Firefox et IE */
        .scrollbar-none {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </div>
  );
}
