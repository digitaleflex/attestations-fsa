"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  CheckCircle,
  Target,
  Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { div as MotionDiv } from "framer-motion/client";
import { AnimatePresence } from "@/lib/framer-motion-client";

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

  // Normalisation accents/casse : le champ promet la recherche par compétence.
  const normalizeSearch = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  const normalizedSearch = normalizeSearch(searchTerm.trim());

  const filteredFormations = initialFormations.filter(f => {
    const matchesSearch =
      normalizedSearch === "" ||
      [f.name, f.description, ...(f.skills ?? [])].some((field) =>
        normalizeSearch(field).includes(normalizedSearch),
      );
    const matchesCategory = activeCategory === "Toutes" || f.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white font-sans selection:bg-brand selection:text-white">
      {/* --- HERO COMPACT (#335) --- */}
      <section className="relative px-4 pb-4 pt-10 md:px-6 md:pt-14">
        <div className="mx-auto max-w-7xl">
          <MotionDiv
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center space-y-4 text-center"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              Formations FSA
            </p>

            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-brand-ink sm:text-4xl md:text-5xl">
              Choisissez une formation pour développer vos compétences.
            </h1>

            <p className="max-w-xl px-2 text-sm font-medium leading-relaxed text-brand-muted md:text-base">
              Comparez les domaines et les compétences visées, puis envoyez une
              demande de préinscription à l’équipe FSA.
            </p>
          </MotionDiv>
        </div>
      </section>

      {/* --- CATALOGUE : recherche + filtres + compteur regroupés (#335) --- */}
      <section aria-labelledby="catalogue-title" className="relative mx-auto w-full max-w-7xl px-4 pt-4 md:px-6">
        <div className="rounded-2xl border border-brand-line bg-white p-4 shadow-sm md:p-5">
          <h2 id="catalogue-title" className="text-base font-black text-brand-ink">
            Catalogue des formations
          </h2>

          <div
            role="search"
            aria-labelledby="formation-search-label"
            className="mt-3 rounded-2xl border border-brand-line bg-white p-1.5 transition-colors focus-within:border-brand"
          >
            <label id="formation-search-label" htmlFor="formation-search" className="sr-only">
              Rechercher une formation ou une compétence
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center">
                <Search className="absolute left-4 h-5 w-5 text-brand-muted" aria-hidden="true" />
                <Input
                  ref={searchInputRef}
                  id="formation-search"
                  type="search"
                  placeholder="Rechercher une formation ou une compétence..."
                  aria-describedby="formation-search-results"
                  aria-controls="formations-results"
                  aria-keyshortcuts="Control+K Meta+K"
                  className="h-12 w-full border-none bg-transparent pl-12 pr-4 text-base font-medium text-brand-ink placeholder:font-normal placeholder:text-brand-muted focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <fieldset className="mt-3">
            <legend className="sr-only">Filtrer les formations par spécialité</legend>
            <div className="scrollbar-none flex w-full max-w-full items-center justify-start gap-2 overflow-x-auto px-1 pb-1 pt-1 md:justify-start md:overflow-visible md:flex-wrap">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveCategory(cat)}
                    className={`min-h-11 shrink-0 whitespace-nowrap rounded-2xl border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                      isActive
                        ? "border-brand bg-brand text-white"
                        : "border-brand-line bg-white text-brand-muted hover:border-brand hover:text-brand-ink"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p id="formation-search-results" role="status" aria-live="polite" className="mt-3 text-sm font-semibold text-brand-muted">
            {filteredFormations.length} {filteredFormations.length > 1 ? "formations trouvées" : "formation trouvée"}
            {activeCategory !== "Toutes" ? ` dans la catégorie ${activeCategory}` : ""}
            {searchTerm ? ` pour « ${searchTerm} »` : ""}.
          </p>
        </div>
      </section>

      {/* --- GRILLE DES FORMATIONS --- */}
      <section id="formations-results" className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 md:px-6" aria-label="Résultats du catalogue">
        <AnimatePresence mode="popLayout">
          <MotionDiv
            layout
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredFormations.map((f, idx) => (
              <MotionDiv
                key={f.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.2) }}
              >
                <Card className="flex h-full flex-col rounded-2xl border border-brand-line bg-white p-6 shadow-sm transition-colors hover:border-brand/40 hover:shadow-md">
                  <div className="mb-4">
                    <Badge variant="outline" className="rounded-full border-brand/20 bg-brand/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-dark">
                      {f.category}
                    </Badge>
                  </div>

                  <h3 className="mb-2 text-lg font-black leading-snug tracking-tight text-brand-ink">
                    <Link
                      href={`/formations/${f.id}`}
                      className="rounded transition-colors hover:text-brand hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      {f.name}
                    </Link>
                  </h3>

                  <p className="mb-5 line-clamp-3 text-sm font-normal leading-relaxed text-brand-muted">
                    {f.description}
                  </p>

                  {f.skills.length > 0 && (
                    <div className="mb-6">
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                        <Activity className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                        Compétences visées
                      </p>
                      <ul className="space-y-2">
                        {f.skills.slice(0, 3).map((skill, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-2">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                            <span className="text-xs font-medium text-brand-ink">{skill}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-auto">
                    <Button asChild className="min-h-11 w-full rounded-2xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
                      <Link href={`/formations/${f.id}`}>
                        Découvrir la formation
                        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              </MotionDiv>
            ))}
          </MotionDiv>
        </AnimatePresence>

        {/* Empty State */}
        {filteredFormations.length === 0 && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-brand-line bg-white py-16 text-center shadow-sm"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand/5">
              <Target className="h-7 w-7 text-brand-muted" />
            </div>
            <h3 className="mb-2 text-lg font-black tracking-tight text-brand-ink">Aucune formation trouvée</h3>
            <p className="mx-auto max-w-sm px-4 text-sm font-medium text-brand-muted">Recherchez avec d&apos;autres termes ou parcourez une autre catégorie.</p>
            <Button
              variant="link"
              className="mt-4 min-h-11 font-bold text-brand hover:text-brand-dark"
              onClick={() => {setSearchTerm(""); setActiveCategory("Toutes");}}
            >
              Réinitialiser la recherche
            </Button>
          </MotionDiv>
        )}

        {/* Réassurance placée près de l'action (#335) : après le catalogue, avant la suite du parcours */}
        {filteredFormations.length > 0 && (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-brand-line bg-brand/[0.03] px-5 py-4 text-center">
            <h2 className="text-sm font-black text-brand-ink">
              La préinscription exprime votre intérêt
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-brand-muted sm:text-sm">
              L’envoi du formulaire transmet votre demande. Il ne confirme pas à lui
              seul l’inscription ni les modalités de la formation.
            </p>
          </div>
        )}
      </section>

      <style jsx global>{`
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
