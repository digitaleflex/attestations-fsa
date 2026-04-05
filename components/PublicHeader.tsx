"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Menu, X, LogIn } from "lucide-react";
import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import Image from "next/image";

export function PublicHeader() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname !== "/") return false;
    return pathname.startsWith(path);
  };

  const navLinks = [
    { label: "Accueil", href: "/", color: "slate" },
    { label: "Stages", href: "/demande-stage", color: "blue" },
    { label: "Formations", href: "/formations", color: "emerald" },
    { label: "Examens", href: "/exams", color: "blue" },
    { label: "Ressources", href: "/ressources", color: "emerald" },
    { label: "FAQ", href: "/faq", color: "amber" },
    { label: "Contact", href: "/contact", color: "emerald" },
  ];

  return (
    <header className="w-full flex justify-between items-center px-6 md:px-12 py-4 sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300 hover:bg-white/90">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
            <div className="relative w-10 h-10 overflow-hidden rounded-xl shadow-emerald-200/50 shadow-lg">
            <Image src="/logo-fsa.png" alt="Logo FSA" fill sizes="40px" className="object-cover" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-black text-slate-900 leading-none uppercase tracking-tighter italic">Ferme Agro-piscicole</span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.1em]">St Andre</span>
            </div>
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex gap-1 items-center bg-slate-50/50 p-1 rounded-2xl border border-slate-100">
        {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href} 
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-xs uppercase tracking-wider text-center ${
                isActive(link.href) 
                  ? "bg-white shadow-sm text-slate-900 scale-105" 
                  : `text-slate-600 hover:text-${link.color}-700 hover:bg-${link.color}-50/50`
              }`}
            >
              {link.label}
              {isActive(link.href) && <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
            </Link>
        ))}

        <div className="w-px h-6 bg-slate-200 mx-2" />

        {session ? (
          <button
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all text-xs uppercase tracking-wider"
          >
            Déconnexion
          </button>
        ) : (
          <Link href="/auth" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all text-xs uppercase tracking-wider">
            <LogIn className="w-4 h-4" />
            Connexion
          </Link>
        )}

        <Link href="/verifier" className="ml-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-black text-xs uppercase tracking-[0.15em] hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg">
          <ShieldCheck className="w-4 h-4" />
          Vérifier
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <button
        className="md:hidden p-2.5 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile menu modal style */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 p-4 bg-white/95 backdrop-blur-2xl border-b border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="grid grid-cols-1 gap-2">
                {navLinks.map((link) => (
                    <Link 
                        key={link.href}
                        href={link.href} 
                        onClick={() => setOpen(false)} 
                        className={`p-4 rounded-2xl font-bold uppercase text-xs tracking-widest flex items-center justify-between ${
                            isActive(link.href)
                                ? "bg-slate-50 text-slate-900 border-l-4 border-emerald-500 pl-6"
                                : "hover:bg-slate-50 text-slate-600"
                        }`}
                    >
                        {link.label}
                        {isActive(link.href) && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </Link>
                ))}
                
                <div className="h-px bg-slate-100 mx-2" />
                <Link href="/auth" onClick={() => setOpen(false)} className="p-4 rounded-2xl text-slate-600 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                    <LogIn className="w-4 h-4" /> Se connecter
                </Link>
                <Link href="/verifier" onClick={() => setOpen(false)} className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2">
                    <ShieldCheck className="w-5 h-5" /> Vérifier
                </Link>
           </div>
        </div>
      )}
    </header>
  );
}
