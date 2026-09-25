"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Menu, X, LogIn, ArrowRight, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { div as MotionDiv } from "framer-motion/client";
import { AnimatePresence } from "@/lib/framer-motion-client";

export function PublicHeader() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    const menu = menuRef.current;
    menu?.querySelector<HTMLElement>("a, button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

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
    <header
      ref={headerRef}
      className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-brand-line/80 bg-white/95 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl md:px-10 md:py-4 lg:px-12"
    >
      <div className="flex items-center gap-3">
        <Link href="/" className="group flex items-center gap-2.5 rounded-xl md:gap-3" aria-label="Ferme Agro-piscicole Saint André — Accueil">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl shadow-sm shadow-brand/20 transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105 md:h-10 md:w-10">
              <Image src="/logo-fsa.png" alt="" fill sizes="40px" className="object-cover" priority />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-extrabold uppercase leading-none tracking-[-0.02em] text-brand-ink md:text-xs">Ferme Agro-piscicole</span>
                <span className="mt-1 text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-brand md:text-[9px]">Saint André</span>
            </div>
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 rounded-2xl border border-brand-line/70 bg-slate-50/90 p-1 lg:flex" aria-label="Navigation principale">
        {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors ${
                isActive(link.href)
                  ? "bg-white text-brand shadow-sm"
                  : "text-slate-500 hover:bg-white/70 hover:text-brand-ink"
              }`}
            >
              {link.label}
              {isActive(link.href) && <span className="ml-0.5 h-1 w-1 rounded-full bg-brand" aria-hidden="true" />}
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

        <Link href="/verifier" className="ml-1 inline-flex items-center gap-2 rounded-xl bg-brand-ink px-5 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white shadow-md shadow-brand/15 transition-all hover:-translate-y-0.5 hover:bg-brand hover:shadow-lg hover:shadow-brand/25 active:translate-y-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          Vérifier
        </Link>
      </nav>

      {/* Mobile hamburger */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/verifier" className="rounded-xl bg-brand-ink p-2 text-white shadow-sm transition-colors hover:bg-brand" aria-label="Vérifier un certificat">
           <ShieldCheck className="w-5 h-5" />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          className="rounded-xl border border-brand-line bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-ink"
          onClick={() => setOpen(o => !o)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu modal style */}
      <AnimatePresence>
        {open && (
           <MotionDiv
             id="public-mobile-menu"
             ref={menuRef}
             initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "circOut" }}
             className="absolute left-0 right-0 top-full z-[100] border-b border-brand-line bg-white/98 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl lg:hidden"
          >
             <div className="grid grid-cols-1 gap-1.5">
                  {navLinks.map((link) => (
                      <Link 
                          key={link.href}
                           href={link.href}
                           aria-current={isActive(link.href) ? "page" : undefined}
                           onClick={() => setOpen(false)}
                           className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold tracking-wide transition-colors ${
                               isActive(link.href)
                                   ? "bg-brand/8 text-brand"
                                   : "bg-transparent text-slate-600 hover:bg-slate-50 hover:text-brand-ink"
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
          </MotionDiv>
        )}
      </AnimatePresence>
    </header>
  );
}
