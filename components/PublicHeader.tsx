"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Menu,
  X,
  LogIn,
  LogOut,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Hauteur de l'en-tête collant : `py-3` + logo 40px sur mobile, `py-4` +
 * logo 40px à partir de `md`. Le panneau et son voile démarrent exactement
 * sous l'en-tête, qui reste donc visible — et cliquable, donc refermable.
 */
const HEADER_OFFSET = "top-16 md:top-[4.5rem]";

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
    <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-brand-line/80 bg-white/95 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl md:px-10 md:py-4 lg:px-12">
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

      <nav className="hidden items-center gap-1 rounded-2xl border border-brand-line/70 bg-slate-50/90 p-1 lg:flex" aria-label="Navigation principale">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-colors ${isActive(link.href) ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-brand-ink"}`}
          >
            {link.label}
            {isActive(link.href) && <span className="ml-0.5 h-1 w-1 rounded-full bg-brand" aria-hidden="true" />}
          </Link>
        ))}
        <div className="mx-2 h-6 w-px bg-slate-200/50" />
        {session ? (
          <button onClick={() => signOut()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600">Sortie</button>
        ) : (
          <>
            <Link href="/auth" className="inline-flex items-center gap-2 rounded-xl bg-brand/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand transition-all hover:bg-brand/20"><LogIn className="h-3.5 w-3.5" />Espace Pro</Link>
            <Link href="/inscription" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-50 hover:text-brand"><UserPlus className="h-3.5 w-3.5" />Inscription</Link>
          </>
        )}
        <Link href="/verifier" className="ml-1 inline-flex items-center gap-2 rounded-xl bg-brand-ink px-5 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-white shadow-md shadow-brand/15 transition-all hover:-translate-y-0.5 hover:bg-brand hover:shadow-lg hover:shadow-brand/25 active:translate-y-0"><ShieldCheck className="h-3.5 w-3.5" />Vérifier</Link>
      </nav>

      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/verifier" className="rounded-xl bg-brand-ink p-2 text-white shadow-sm transition-colors hover:bg-brand" aria-label="Vérifier un certificat"><ShieldCheck className="h-5 w-5" /></Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
              className="rounded-xl border border-brand-line bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-ink"
            >
              {open ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </SheetTrigger>
          <SheetContent
            id="public-mobile-menu"
            side="bottom"
            hideCloseButton
            // `side="bottom"` n'apporte que l'animation de glissement ; on
            // repositionne le panneau juste sous l'en-tête (design d'origine :
            // un volet déroulant, pas un tiroir plein écran).
            className={`inset-x-0 bottom-auto ${HEADER_OFFSET} max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-brand-line bg-white/98 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl sm:p-4`}
            overlayClassName={`${HEADER_OFFSET} bg-slate-900/25`}
          >
            <SheetTitle className="sr-only">Menu principal</SheetTitle>
            <SheetDescription className="sr-only">
              Accéder aux pages principales du site.
            </SheetDescription>
            <nav aria-label="Navigation mobile" className="grid grid-cols-1 gap-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold tracking-wide transition-colors ${isActive(link.href) ? "bg-brand/8 text-brand" : "text-slate-600 hover:bg-slate-50 hover:text-brand-ink"}`}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <ArrowRight className="h-4 w-4 text-brand" />
                  )}
                </Link>
              ))}
              <div className="my-2 h-px bg-slate-100" />
              {session ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/auth"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    <LogIn className="h-4 w-4" />
                    Connexion
                  </Link>
                  <Link
                    href="/inscription"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-brand/10 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-brand-dark transition-colors hover:bg-brand/20"
                  >
                    <UserPlus className="h-4 w-4" />
                    Inscription
                  </Link>
                </div>
              )}
              <Link
                href="/verifier"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-brand/20 transition-colors hover:bg-brand-dark"
              >
                <ShieldCheck className="h-4 w-4" />
                Vérifier
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
