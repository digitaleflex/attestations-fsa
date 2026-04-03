"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

const HEADLINES = [
  { 
    id: 1,
    text: "L'Excellence au Confluent de la Terre et de l'Eau.",
    highlights: ["Terre", "l'Eau"] 
  },
  { 
    id: 2,
    text: "Innovation en Pisciculture, Agriculture et Élevage.",
    highlights: ["Pisciculture", "Agriculture", "Élevage"]
  },
  { 
    id: 3,
    text: "Bâtissons l'Avenir de l'Économie Verte au Bénin.",
    highlights: ["Avenir", "Bénin"]
  }
];

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % HEADLINES.length);
    }, 15000); // Change every 15 seconds
    return () => clearInterval(timer);
  }, []);

  const current = HEADLINES[index];
  const words = current.text.split(" ");

  return (
    <div className="min-h-[140px] md:min-h-[200px] flex items-center justify-center w-full overflow-visible py-4">
      <AnimatePresence mode="wait">
        <motion.h1
          key={index}
          className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[1.05] lg:max-w-5xl mx-auto px-4"
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ 
            duration: 0.8,
            ease: "easeOut"
          }}
        >
          {words.map((word, wordIdx) => {
            const isTerre = word.includes("Terre");
            const isEau = word.includes("l'Eau");
            const isPillar = ["Pisciculture", "Agriculture", "Élevage"].some(p => word.includes(p));
            const isImpact = ["Avenir", "Bénin"].some(p => word.includes(p));
            
            const highlightClass = isTerre || (isPillar && !isEau) || isImpact ? "text-emerald-600" : isEau ? "text-blue-600" : "";

            return (
              <span key={wordIdx} className={`inline-block mr-[0.25em] ${highlightClass}`}>
                {word}
              </span>
            );
          })}
        </motion.h1>
      </AnimatePresence>
    </div>
  );
}
