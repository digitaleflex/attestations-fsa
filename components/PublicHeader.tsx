"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Menu, X, LogIn, ArrowRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export function PublicHeader() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname?.startsWith(path)) return true;
    return false;
  };

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Formations", href: "/formations" },
    { label: "Examens", href: "/examens" },
    { label: "Stages", href: "/demande-stage" },
  ];

  return (
    <header className="w-full flex justify-between items-center px-4 md:px-12 py-3 md:py-4 sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-slate-100/50 shadow-sm transition-all duration-500">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="relative w-8 h-8 md:w-10 md:h-10 overflow-hidden rounded-lg md:rounded-xl shadow-brand/20 shadow-lg group-hover:scale-105 transition-transform duration-500">
              <Image src="/logo-fsa.png" alt="Logo FSA" fill sizes="40px" className="object-cover" priority />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] md:text-xs font-black text-slate-900 leading-none uppercase tracking-tighter italic">Ferme Agro-piscicole</span>
                <span className="text-[8px] md:text-[10px] font-medium text-slate-400 uppercase tracking-[0.1em]">St Andre</span>
            </div>
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="hidden lg:flex gap-1 items-center bg-slate-50/80 p-1 rounded-2xl border border-slate-100/50 backdrop-blur-md">
        {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest text-center ${
                isActive(link.href) 
                  ? "bg-white shadow-sm text-brand scale-105" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              {link.label}
              {isActive(link.href) && <div className="w-1 h-1 rounded-full bg-brand/100 ml-0.5" />}
            </Link>
        ))}

        <div className="w-px h-6 bg-slate-200/50 mx-2" />

        {session ? (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all text-[10px] uppercase tracking-widest"
          >
            Sortie
          </button>
        ) : (
          <>
            <Link href="/auth" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-brand bg-brand/10 hover:bg-brand/20 transition-all text-[10px] uppercase tracking-widest">
              <LogIn className="w-3.5 h-3.5" />
              Espace Pro
            </Link>
            <Link href="/inscription" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-brand transition-all text-[10px] uppercase tracking-widest">
              <UserPlus className="w-3.5 h-3.5" />
              Inscription
            </Link>
          </>
        )}

        <Link href="/verifier" className="ml-1 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.15em] hover:bg-brand hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg">
          <ShieldCheck className="w-3.5 h-3.5" />
          Vérifier
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/verifier" className="p-2 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
           <ShieldCheck className="w-5 h-5" />
        </Link>
        <button
          className="p-2.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-100 shadow-sm transition-all active:scale-90"
          onClick={() => setOpen(o => !o)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu modal style */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="lg:hidden absolute top-full left-0 right-0 p-4 bg-white/95 backdrop-blur-3xl border-b border-slate-100 shadow-2xl z-[100]"
          >
             <div className="grid grid-cols-1 gap-1.5">
                  {navLinks.map((link) => (
                      <Link 
                          key={link.href}
                          href={link.href} 
                          onClick={() => setOpen(false)} 
                          className={`p-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-between transition-all ${
                              isActive(link.href)
                                  ? "bg-brand/10 text-brand-dark shadow-sm"
                                  : "bg-transparent text-slate-500 hover:bg-slate-50"
                          }`}
                      >
                          {link.label}
                          {isActive(link.href) && <ArrowRight className="w-4 h-4 text-brand" />}
                      </Link>
                  ))}
                  
                  <div className="h-px bg-slate-100 my-2" />
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Link 
                      href="/auth" 
                      onClick={() => setOpen(false)} 
                      className="p-4 rounded-xl bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-4 h-4" /> Connexion
                    </Link>
                    <Link 
                      href="/inscription" 
                      onClick={() => setOpen(false)} 
                      className="p-4 rounded-xl bg-brand/10 text-brand-dark font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" /> Inscription
                    </Link>
                  </div>
                  <Link 
                    href="/verifier" 
                    onClick={() => setOpen(false)} 
                    className="p-4 rounded-xl bg-brand text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-brand/20"
                  >
                      <ShieldCheck className="w-4 h-4" /> Vérifier
                  </Link>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
