"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardCheck,
  FileCheck,
  FileText,
  AlertCircle,
  Mail,
  Bell,
  Settings,
  User,
  Plus,
  Search,
  CornerDownLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface PaletteEntry {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const NAV_ENTRIES: PaletteEntry[] = [
  { id: "nav-dashboard", group: "Navigation", label: "Vue d'ensemble", icon: LayoutDashboard, href: "/admin/dashboard" },
  { id: "nav-users", group: "Navigation", label: "Apprenants", icon: Users, href: "/admin/users" },
  { id: "nav-formations", group: "Navigation", label: "Catalogue pédagogique", icon: BookOpen, href: "/admin/formations" },
  { id: "nav-exams", group: "Navigation", label: "Examens", icon: ClipboardCheck, href: "/admin/exams" },
  { id: "nav-corrections", group: "Navigation", label: "Corrections", icon: FileCheck, href: "/admin/corrections" },
  { id: "nav-attestations", group: "Navigation", label: "Attestations", icon: FileText, href: "/admin/attestations" },
  { id: "nav-reclamations", group: "Navigation", label: "Réclamations", icon: AlertCircle, href: "/admin/reclamations" },
  { id: "nav-contacts", group: "Navigation", label: "Messages", icon: Mail, href: "/admin/contacts" },
  { id: "nav-notifications", group: "Navigation", label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { id: "nav-settings", group: "Navigation", label: "Paramètres", icon: Settings, href: "/admin/settings" },
  { id: "nav-profile", group: "Navigation", label: "Mon profil", icon: User, href: "/admin/profile" },
];

const CREATE_ENTRIES: PaletteEntry[] = [
  { id: "new-user", group: "Créer", label: "Nouvel apprenant", hint: "dialogue", icon: Plus, href: "/admin/users" },
  { id: "new-attestation", group: "Créer", label: "Nouvelle attestation", icon: Plus, href: "/admin/attestations/new" },
  { id: "new-exam", group: "Créer", label: "Nouvel examen", icon: Plus, href: "/admin/exams/new" },
  { id: "new-formation", group: "Créer", label: "Nouvelle formation", icon: Plus, href: "/admin/formations/new" },
];

interface FoundUser {
  id: string;
  name: string | null;
  email: string | null;
}

function matches(entry: PaletteEntry, q: string): boolean {
  const hay = `${entry.label} ${entry.group}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

/**
 * Palette de commande admin (Cmd/Ctrl+K).
 * Sans dépendance externe : Dialog Radix + navigation clavier native
 * (flèches + Entrée + Échap), rôles listbox/option, recherche
 * apprenants en direct (debounce 300 ms).
 */
export function AdminCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [found, setFound] = React.useState<FoundUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K global + événement du bouton header (admin uniquement — composant monté dans le layout admin)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onTrigger = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("admin:open-palette", onTrigger);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("admin:open-palette", onTrigger);
    };
  }, []);

  // Reset à l'ouverture
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setFound([]);
      setActiveId(null);
    }
  }, [open ]);

  // Recherche apprenants en direct
  React.useEffect(() => {
    const q = debouncedQuery.trim();
    if (!open || q.length < 2) {
      setFound([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetch(`/api/users?q=${encodeURIComponent(q)}&limit=5`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setFound(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setFound([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const staticResults = React.useMemo(() => {
    const q = query.trim();
    if (!q) return [...NAV_ENTRIES.slice(0, 5), ...CREATE_ENTRIES];
    return [...NAV_ENTRIES, ...CREATE_ENTRIES].filter((e) => matches(e, q));
  }, [query]);

  const userResults: PaletteEntry[] = React.useMemo(
    () =>
      found.map((u) => ({
        id: `user-${u.id}`,
        group: "Apprenants",
        label: u.name || u.email || "Sans nom",
        hint: u.email || undefined,
        icon: Users,
        href: `/admin/users?q=${encodeURIComponent(u.email || u.name || "")}`,
      })),
    [found],
  );

  const groups = React.useMemo(() => {
    const all = [...staticResults, ...userResults];
    const map = new Map<string, PaletteEntry[]>();
    for (const e of all) {
      const list = map.get(e.group) ?? [];
      list.push(e);
      map.set(e.group, list);
    }
    return [...map.entries()];
  }, [staticResults, userResults]);

  const flat = React.useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  // L'élément actif suit la liste (1er par défaut)
  React.useEffect(() => {
    setActiveId(flat.length > 0 ? flat[0].id : null);
  }, [flat]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (flat.length === 0) return;
    const idx = flat.findIndex((f) => f.id === activeId);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveId(flat[(idx + 1) % flat.length].id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveId(flat[(idx - 1 + flat.length) % flat.length].id);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = flat.find((f) => f.id === activeId) ?? flat[0];
      if (current) go(current.href);
    }
  };

  // Scroll l'option active dans la vue
  React.useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector(`[data-entry-id="${activeId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        aria-label="Recherche rapide"
        className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-3xl border-2 border-slate-100 p-0 shadow-2xl"
      >
        <DialogTitle className="sr-only">Recherche rapide admin</DialogTitle>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
          <input
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-palette-list"
            aria-activedescendant={activeId ?? undefined}
            aria-label="Rechercher une page, une action ou un apprenant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Rechercher une page, une action ou un apprenant..."
            autoComplete="off"
            className="h-14 w-full bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searching && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ...
            </span>
          )}
          <kbd
            aria-hidden="true"
            className="hidden shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500 sm:block"
          >
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="admin-palette-list"
          role="listbox"
          aria-label="Résultats"
          className="max-h-[50vh] overflow-y-auto p-2"
        >
          {flat.length === 0 ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-slate-500">
              {query.trim()
                ? "Aucun résultat. Essayez un autre mot-clé."
                : "Tapez pour rechercher."}
            </p>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p
                  aria-hidden="true"
                  className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400"
                >
                  {group}
                </p>
                {items.map((entry) => {
                  const Icon = entry.icon;
                  const active = entry.id === activeId;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      id={`palette-${entry.id}`}
                      aria-selected={active}
                      data-entry-id={entry.id}
                      onClick={() => go(entry.href)}
                      onMouseMove={() => {
                        if (!active) setActiveId(entry.id);
                      }}
                      className={cn(
                        "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                        active ? "bg-brand/10" : "bg-transparent",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          active ? "bg-brand text-white" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">
                          {entry.label}
                        </span>
                        {entry.hint && (
                          <span className="block truncate text-xs text-slate-500">
                            {entry.hint}
                          </span>
                        )}
                      </span>
                      {active && (
                        <CornerDownLeft
                          className="h-4 w-4 shrink-0 text-brand"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          aria-hidden="true"
          className="hidden items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[11px] font-medium text-slate-400 sm:flex"
        >
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-black">↑↓</kbd> naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-black">Entrée</kbd> ouvrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-black">Échap</kbd> fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
