"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Sprout, 
  Search, 
  ArrowRight, 
  CheckCircle, 
  Sparkles,
  Target,
  X,
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

// Helper pour associer le format de formation de manière réaliste
const getFormationFormat = (name: string) => {
  const nameLower = name.toLowerCase();
  
  let format = "90% Pratique";
  
  if (nameLower.includes("court") || nameLower.includes("accélér") || nameLower.includes("intens")) {
    format = "Pratique Intensive";
  } else if (nameLower.includes("week-end") || nameLower.includes("samedi")) {
    format = "Week-ends uniquement";
  } else if (nameLower.includes("spécial") || nameLower.includes("expert")) {
    format = "Immersion Professionnelle";
  }
  
  return format;
};

// Helper pour générer des thèmes de couleurs selon la spécialité (neuromarketing visuel)
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
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-900 leading-[0.95] tracking-tight max-w-4xl">
              Devenez un expert de <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand via-brand-dark to-brand-dark">
                l'Or Vert & Bleu.
              </span>
            </h1>

            <p className="text-slate-500 text-sm md:text-base max-w-xl font-medium leading-relaxed px-4">
              Explorez nos programmes d'élite conçus pour transformer votre vision 
              en entreprise agro-piscicole prospère et durable.
            </p>

            {/* Barre de recherche minimaliste */}
            <div className="w-full max-w-xl mx-auto pt-6 px-2 md:px-0">
              <div className="bg-white rounded-2xl border border-slate-200/60 p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/5 transition-all duration-300">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4" />
                    <Input 
                      ref={searchInputRef}
                      placeholder="Rechercher une formation ou une compétence..."
                      className="w-full h-12 pl-12 pr-4 bg-transparent border-none focus:ring-0 text-base font-bold tracking-wide text-slate-800 placeholder:text-slate-300 placeholder:font-normal"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Puces de catégories défilantes horizontales (Scrollable Pills) */}
              <div className="mt-6 flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-3 pt-1 px-1 scrollbar-none w-full">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all duration-300 shrink-0 ${
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-950/10 scale-105"
                          : "bg-white text-slate-500 border-slate-200/80 hover:text-slate-800 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- FORMATIONS GRID --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 mt-8 pb-20">
        <AnimatePresence mode="popLayout">
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {filteredFormations.map((f, idx) => {
              const style = getCategoryStyle(f.category);
              const format = getFormationFormat(f.name);
              
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
                    
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6 line-clamp-3 relative z-10">
                      {f.description}
                    </p>

                    {/* Badge Format d'apprentissage */}
                    <div className="flex items-center gap-2 mb-8 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 w-fit relative z-10">
                      <Activity className="w-4 h-4 text-brand animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{format}</span>
                    </div>

                    {/* Compétences clés */}
                    <div className="grid grid-cols-1 gap-3 mb-8 relative z-10">
                      {f.skills.slice(0, 3).map((skill, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-3.5 group/skill">
                          <div className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center bg-slate-50/50 border border-slate-100 group-hover/skill:${style.bg} transition-colors duration-300`}>
                            <CheckCircle className="w-3.5 h-3.5 text-slate-200 group-hover/skill:text-inherit transition-colors duration-300" />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 group-hover/skill:text-slate-900 transition-colors duration-300">{skill}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bouton d'action */}
                    <div className="mt-auto relative z-10">
                      <Link href={`/formations/inscription?formationId=${f.id}`} className="block">
                        <Button className={`w-full h-14 rounded-2xl bg-slate-900 text-white font-black hover:text-white transition-all duration-500 group/btn active:scale-[0.98] text-xs uppercase tracking-widest shadow-lg shadow-slate-100 ${style.btnHover}`}>
                          <span className="flex items-center justify-center gap-2">
                            S'inscrire
                            <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1.5" />
                          </span>
                        </Button>
                      </Link>
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
                <Target className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Aucune spécialité trouvée</h3>
            <p className="text-slate-400 max-w-sm mx-auto font-medium text-sm">Recherchez avec d'autres termes ou parcourez une autre catégorie.</p>
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
