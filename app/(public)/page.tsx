"use client";
import Link from "next/link";
import { 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle, 
  Eye, 
  ClipboardCheck, 
  Briefcase, 
  GraduationCap, 
  Users2, 
  Sprout, 
  MapPin, 
  ArrowUpRight,
  Fish,
  Droplets,
  Waves
} from "lucide-react";
import { StatsDisplay } from '@/components/stats-display';
import { HowItWorks } from '@/components/how-it-works';
import { FaqSection } from '@/components/faq-section';

import { useEffect, useState } from "react";

function TypewriterEffect({ messages }: { messages: string[] }) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    const handleTyping = () => {
      const fullMessage = messages[currentMessageIndex];
      
      if (!isDeleting) {
        setCurrentText(fullMessage.substring(0, currentText.length + 1));
        setTypingSpeed(70);

        if (currentText === fullMessage) {
          setTimeout(() => setIsDeleting(true), 2500);
          setTypingSpeed(100);
        }
      } else {
        setCurrentText(fullMessage.substring(0, currentText.length - 1));
        setTypingSpeed(40);

        if (currentText === "") {
          setIsDeleting(false);
          setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
          setTypingSpeed(100);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, messages, currentMessageIndex, typingSpeed]);

  return (
    <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto leading-relaxed min-h-[4rem] px-4">
      {currentText}
      <span className="inline-block w-[2px] h-6 bg-emerald-500 ml-1 animate-pulse" />
    </p>
  );
}

export default function Home() {
  const heroMessages = [
    "Spécialistes en Pisciculture, Agriculture et Élevage à la Cité St André.",
    "Développez vos compétences avec nos formations certifiantes de haut niveau.",
    "Rejoignez notre programme de stage pour une immersion pratique d'excellence.",
    "Votre avenir professionnel dans l'agro-pisciculture commence ici.",
    "Vérifiez l'authenticité de vos certificats en un clic sur ce portail."
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-24 pb-24 overflow-x-hidden relative">
      
      {/* --- BACKGROUND ANIMATED ELEMENTS --- */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200/20 blur-[120px] rounded-full animate-float opacity-50" />
        <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-blue-200/20 blur-[100px] rounded-full animate-float delay-1000 opacity-50" />
        
        {/* Floating Icons (Pisciculture/Agriculture) */}
        <div className="absolute top-20 left-[15%] text-emerald-100/40 animate-float duration-[8s]">
          <Fish className="w-16 h-16 rotate-12" />
        </div>
        <div className="absolute top-40 right-[10%] text-blue-100/40 animate-float delay-700 duration-[10s]">
          <Waves className="w-20 h-20" />
        </div>
        <div className="absolute bottom-40 left-[5%] text-emerald-100/30 animate-float delay-500 duration-[12s]">
          <Sprout className="w-24 h-24 -rotate-12" />
        </div>
        <div className="absolute top-1/2 right-[15%] text-blue-100/30 animate-float delay-200 duration-[9s]">
          <Droplets className="w-12 h-12" />
        </div>
      </div>

      {/* --- HERO SECTION --- */}
      <section className="max-w-6xl w-full pt-12 md:pt-20 flex flex-col items-center text-center space-y-12 relative px-4">
        
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-50/80 backdrop-blur-md border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top-4 duration-1000 shadow-sm">
            <Sprout className="w-3 h-3" />
            Portail Officiel • Côte St André
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] max-w-5xl mx-auto">
            <span className="block animate-in fade-in slide-in-from-left-8 duration-700 delay-100 fill-mode-both">
               L'excellence de la
            </span>
            <span className="relative inline-block mt-2 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 animate-gradient-x px-2">
                 Pisciculture
               </span>
               <div className="absolute -bottom-2 left-0 w-full h-1 bg-emerald-200/50 rounded-full scale-x-0 animate-in slide-in-from-left-0 duration-1000 delay-1000 fill-mode-both" />
            </span>
            <br />
            <span className="block mt-2 text-slate-400/50 animate-in fade-in zoom-in-95 duration-1000 delay-500 fill-mode-both">
               & de l'Agriculture.
            </span>
          </h1>
          
          <TypewriterEffect messages={heroMessages} />
        </div>

        {/* --- THREE PILLARS (QUICK ACCESS) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl pt-4 animate-in fade-in slide-in-from-bottom-12 delay-1000 duration-1000 fill-mode-both">
          {/* Link 1: Verification */}
          <Link href="/verifier" className="group">
             <CardPillar 
               icon={ShieldCheck} 
               title="Certificats" 
               desc="Authentifiez instantanément vos attestations via QR code ou numéro unique."
               color="emerald"
             />
          </Link>
          
          {/* Link 2: Exams */}
          <Link href="/exams" className="group">
             <CardPillar 
               icon={ClipboardCheck} 
               title="Examen Portal" 
               desc="Espace dédié pour vos sessions d'évaluations et le suivi de vos résultats."
               color="blue"
             />
          </Link>
          
          {/* Link 3: Internship */}
          <Link href="/demande-stage" className="group">
             <CardPillar 
               icon={Briefcase} 
               title="Postes de Stage" 
               desc="Rejoignez notre cité pour une immersion pratique d'excellence sur le terrain."
               color="rose"
             />
          </Link>
        </div>
        
        <div className="pt-8 animate-in fade-in delay-[1500ms] duration-1000 fill-mode-both">
           <StatsDisplay />
        </div>
      </section>

      {/* --- PROMISES / ADVANTAGES --- */}
      <section className="w-full max-w-7xl px-6 md:px-12">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[4rem] shadow-2xl p-12 md:p-20 grid grid-cols-1 md:grid-cols-3 gap-16 relative overflow-hidden group">
           <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[150%] bg-gradient-to-br from-emerald-100/20 to-blue-100/20 rotate-12 -z-10 group-hover:rotate-0 transition-transform duration-[2s]" />
           
           <Advantage 
             icon={CheckCircle} 
             title="Innovation" 
             desc="Techniques modernes de pisciculture en circuit fermé et agriculture durable." 
             color="emerald"
           />
           <Advantage 
             icon={ShieldCheck} 
             title="Sécurité" 
             desc="Données cryptées et traçabilité totale des certificats délivrés." 
             color="blue"
           />
           <Advantage 
             icon={Users2} 
             title="Proximité" 
             desc="Un accompagnement personnalisé au cœur de la Cité St André." 
             color="teal"
           />
        </div>
      </section>

      {/* --- HOW IT WORKS / FAQ --- */}
      <div className="w-full max-w-7xl animate-in slide-in-from-bottom-12 duration-1000">
        <HowItWorks />
      </div>

      <div className="w-full max-w-5xl py-12 border-t border-slate-200/50">
        <FaqSection />
      </div>
    </div>
  );
}

function CardPillar({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50/50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    blue: 'bg-blue-50/50 border-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white',
    rose: 'bg-rose-50/50 border-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
  };

  return (
    <div className="h-full p-10 bg-white/70 backdrop-blur-md border border-white/80 rounded-[3rem] shadow-xl shadow-slate-200/10 hover:shadow-2xl hover:shadow-emerald-900/5 hover:-translate-y-3 transition-all duration-700 text-left relative overflow-hidden isolate">
      <div className="absolute top-6 right-10 opacity-0 group-hover:opacity-20 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all duration-700 -z-10 scale-150">
        <Icon className="w-12 h-12" />
      </div>
      
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 mb-10 shadow-sm ${colors[color]}`}>
        <Icon className="w-8 h-8" />
      </div>
      
      <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight leading-none group-hover:text-emerald-700 transition-colors uppercase italic underline decoration-slate-100 decoration-8 underline-offset-4 pointer-events-none">
        {title}
      </h3>
      <p className="text-slate-500 group-hover:text-slate-700 leading-relaxed font-medium text-lg">
        {desc}
      </p>
    </div>
  );
}

function Advantage({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 group/item">
      <div className={`w-20 h-20 rounded-[2rem] bg-white flex items-center justify-center text-${color}-600 shadow-xl border border-slate-100 group-hover/item:scale-110 group-hover/item:rotate-12 transition-transform duration-500`}>
        <Icon className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h4 className="text-2xl font-black text-slate-900 italic uppercase">
          {title}
        </h4>
        <p className="text-slate-400 text-base font-medium leading-relaxed max-w-xs mx-auto">
          {desc}
        </p>
      </div>
    </div>
  );
}
