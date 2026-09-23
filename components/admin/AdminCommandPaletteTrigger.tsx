"use client";

import { Search } from "lucide-react";

/**
 * Bouton déclencheur de la palette (header admin).
 * Communique via événement DOM pour rester découplé.
 */
export function AdminCommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("admin:open-palette"))
      }
      aria-label="Recherche rapide (Contrôle K)"
      className="hidden h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500 transition-colors hover:border-brand-line hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:flex"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="hidden lg:inline">Rechercher...</span>
      <kbd
        aria-hidden="true"
        className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-500"
      >
        Ctrl K
      </kbd>
    </button>
  );
}
