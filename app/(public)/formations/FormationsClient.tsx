"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Sprout, 
  Search, 
  ArrowRight, 
  CheckCircle, 
  Layers,
  Sparkles,
  BookOpen,
  Users,
  Target,
  X,
  Award
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
    <div className="min-h-screen bg-[#fafbfc] selection:bg-emerald-100 selection:text-emerald-900 pb-24 overflow-x-hidden w-full">
      {/* --- PREMIUM GLOW DECOR --- */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-emerald-100/30 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-100/20 rounded-full blur-[100px]" />
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-24 md:pt-36 pb-12 md:pb-24 px-4 md:px-6 z-10">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center space-y-6 md:space-y-8"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-slate-100 shadow-xl shadow-slate-200/50 text-emerald-600">
               <Sparkles className="w-4 h-4 fill-emerald-500" />
               <span className="text-[10px] font-black uppercase tracking-[0.25em]">Excellence FSA</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.95] tracking-tight max-w-5xl">
              Devenez un expert de <br className="hidden md:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600">
                l'Or Vert & Bleu.
              </span>
            </h1>

            <p className="text-slate-500 text-base md:text-lg lg:text-xl max-w-2xl font-medium leading-relaxed px-4">
              Explorez nos programmes d'élite conçus pour transformer votre vision 
              en entreprise agro-piscicole prospère et durable.
            </p>

            {/* Integrated Search & Category Container */}
            <div className="w-full max-w-4xl pt-8 px-2 md:px-0">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="relative group perspective-1000"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-[2rem] opacity-20 group-hover:opacity-40 blur-xl transition duration-500" />
                
                <div className="relative flex flex-col md:flex-row items-stretch md:items-center bg-white/80 backdrop-blur-[50px] rounded-[2rem] border border-white shadow-2xl shadow-slate-200/50 p-2 overflow-hidden">
                  
                  {/* Category Selector Side */}
                  <div className="relative min-w-[160px] flex items-center border-b md:border-b-0 md:border-r border-slate-100 px-4 py-2 md:py-0">
                    <Layers className="w-4 h-4 text-emerald-500 mr-3 shrink-0" />
                    <select 
                      value={activeCategory}
                      onChange={(e) => setActiveCategory(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs md:text-sm font-black uppercase tracking-wider text-slate-700 cursor-pointer w-full appearance-none pr-6"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 pointer-events-none text-slate-400">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                  </div>

                  {/* Search Input Side */}
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-6 w-5 h-5 text-slate-300 md:group-focus-within:text-emerald-500 transition-all duration-300" />
                    <Input 
                      ref={searchInputRef}
                      placeholder="Rechercher une expertise ou un mot-clé..." 
                      className="h-14 md:h-16 pl-14 pr-4 border-none bg-transparent rounded-none focus:ring-0 text-slate-700 font-bold placeholder:text-slate-200 placeholder:font-medium md:text-lg w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    
                    {/* Visual indicators */}
                    <div className="hidden lg:flex items-center gap-2 pr-6 text-slate-200 pointer-events-none">
                      <kbd className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase shadow-sm">Ctrl</kbd>
                      <kbd className="px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[9px] font-black uppercase shadow-sm">K</kbd>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {activeCategory !== "Toutes" && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 cursor-pointer pr-1" onClick={() => setActiveCategory("Toutes")}>
                        {activeCategory}
                        <X className="w-3 h-3 ml-2" />
                    </Badge>
                )}
                {searchTerm && (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 cursor-pointer pr-1" onClick={() => setSearchTerm("")}>
                         "{searchTerm}"
                        <X className="w-3 h-3 ml-2" />
                    </Badge>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- FORMATIONS GRID --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 mt-12 pb-20">
          <AnimatePresence mode="popLayout">
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10"
            >
              {filteredFormations.map((f, idx) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ 
                    duration: 0.5, 
                    delay: idx * 0.1,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                  className="group"
                >
                  <Card className="h-full relative flex flex-col p-8 md:p-10 rounded-[3rem] bg-white border-slate-50 shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] transition-all duration-500 overflow-hidden perspective-1000">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="absolute top-0 right-0 p-8 transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700">
                        <div className="w-16 h-16 bg-emerald-50 rounded-[2rem] flex items-center justify-center opacity-40">
                             <Sprout className="w-8 h-8 text-emerald-500" />
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-6">
                        <Badge variant="outline" className="bg-emerald-50/50 text-emerald-700 border-emerald-100 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                          {f.category}
                        </Badge>
                      </div>
                      
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 tracking-tighter leading-[1.1]">
                        {f.name}
                      </h3>
                      
                      <p className="text-slate-500 text-sm md:text-base font-medium leading-relaxed mb-10 line-clamp-4">
                        {f.description}
                      </p>

                      <div className="grid grid-cols-1 gap-4 mb-12">
                        {f.skills.slice(0, 3).map((skill, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-4 group/skill">
                            <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center group-hover/skill:bg-emerald-100 transition-colors duration-300">
                              <CheckCircle className="w-3.5 h-3.5 text-slate-300 group-hover/skill:text-emerald-500 transition-colors duration-300" />
                            </div>
                            <span className="text-xs md:text-sm font-bold text-slate-600 group-hover/skill:text-slate-900 transition-colors duration-300">{skill}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto">
                        <Link href={`/auth?register=true&formationId=${f.id}`} className="block">
                          <Button className="w-full h-14 md:h-16 rounded-2xl bg-slate-900 text-white font-black hover:bg-emerald-600 hover:shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] transition-all duration-500 group/btn active:scale-[0.98] text-[10px] md:text-xs uppercase tracking-wider relative overflow-hidden">
                            <span className="relative z-10 flex items-center justify-center">
                                S'inscrire au cursus
                                <ArrowRight className="w-5 h-5 ml-3 transition-transform group-hover/btn:translate-x-2" />
                            </span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

        {/* Empty State */}
        {filteredFormations.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-32 rounded-[4rem] bg-white border border-dashed border-slate-200 shadow-2xl"
          >
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <Target className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Aucune spécialité trouvée</h3>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">Recherchez avec d'autres termes ou parcourez une autre catégorie.</p>
            <Button 
                variant="link" 
                className="mt-8 text-emerald-600 font-bold hover:text-emerald-700 transition-all text-base"
                onClick={() => {setSearchTerm(""); setActiveCategory("Toutes");}}
            >
              Réinitialiser ma recherche
            </Button>
          </motion.div>
        )}
      </section>

      {/* --- PREMIUM FEATURES BENTO --- */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="lg:col-span-2 row-span-2 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-[3rem] p-10 md:p-12 text-white flex flex-col justify-end min-h-[350px] shadow-2xl shadow-emerald-900/20 group relative overflow-hidden">
                <div className="absolute top-10 right-10 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BookOpen className="w-32 h-32" />
                </div>
                <h4 className="text-3xl font-black mb-4 leading-tight tracking-tight">Apprentissage Hybride de pointe.</h4>
                <p className="text-emerald-100/80 font-medium leading-relaxed max-w-md">
                    Nos formations combinent théorie intensive et immersion sur le terrain pour une maîtrise totale de l'aquaculture moderne.
                </p>
             </div>
             <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Award className="w-8 h-8" />
                </div>
                <h5 className="font-bold text-slate-800 text-lg mb-2">Certification FSA</h5>
                <p className="text-slate-400 text-xs font-medium">Reconnaissance de vos compétences par l'élite du secteur.</p>
             </div>
             <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Users className="w-8 h-8" />
                </div>
                <h5 className="font-bold text-slate-800 text-lg mb-2">Réseau d'Experts</h5>
                <p className="text-slate-400 text-xs font-medium">Rejoignez une communauté de plus de 1500 exploitants.</p>
             </div>
             <div className="lg:col-span-2 bg-slate-900 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl">
                 <div className="space-y-4">
                    <h5 className="text-2xl font-black text-white leading-tight">Besoin d'un programme sur-mesure ?</h5>
                    <p className="text-slate-400 text-sm font-medium">Contactez nos conseillers pour une formation adaptée à vos besoins techniques.</p>
                 </div>
                 <Link href="/contact">
                     <Button className="h-14 px-8 rounded-2xl bg-white text-slate-900 font-bold hover:bg-emerald-50 transition-all shrink-0">
                        Prendre RDV
                     </Button>
                 </Link>
             </div>
        </div>
      </section>

      {/* Styles additionnels */}
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
}
