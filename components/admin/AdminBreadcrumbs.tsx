"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dashboard: "Vue d'ensemble",
  users: "Apprenants",
  formations: "Catalogue",
  exams: "Examens",
  corrections: "Corrections",
  notifications: "Notifications",
  attestations: "Attestations",
  reclamations: "Réclamations",
  contacts: "Messages",
  settings: "Paramètres",
  profile: "Mon profil",
  submissions: "Soumissions",
  new: "Nouveau",
  edit: "Modifier",
  internships: "Stages",
  logs: "Journaux",
  monitoring: "Monitoring",
  results: "Résultats",
  login: "Connexion",
};

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // IDs dynamiques ([id]) → libellé neutre, jamais l'identifiant brut
  return "Détail";
}

/**
 * Fil d'Ariane admin dérivé du pathname.
 * Sémantique nav > ol > li, page courante en aria-current.
 * Premier niveau « Admin » → dashboard ; segments dynamiques → « Détail ».
 */
export function AdminBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const crumbs = React.useMemo(() => {
    const segments = (pathname || "").split("/").filter(Boolean);
    let href = "";
    return segments.map((seg, i) => {
      href += `/${seg}`;
      return { href, label: labelFor(seg), current: i === segments.length - 1 };
    });
  }, [pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Fil d'Ariane" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <li
            key={`${crumb.href}-${i}`}
            className="flex min-w-0 items-center gap-1"
          >
            {i > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-hidden="true"
              />
            )}
            {crumb.current ? (
              <span
                aria-current="page"
                className="truncate font-bold text-slate-800"
              >
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="truncate rounded font-medium text-slate-500 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
