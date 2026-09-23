import { cn } from "@/lib/utils";
import type { UserStatus } from "@/types";

const STATUS_CONFIG: Record<
  UserStatus,
  { label: string; dot: string; pill: string }
> = {
  ACTIVE: {
    label: "Actif",
    dot: "bg-emerald-600",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  BLOCKED: {
    label: "Bloqué",
    dot: "bg-rose-600",
    pill: "bg-rose-50 text-rose-700 border-rose-200",
  },
  SUSPENDED: {
    label: "Suspendu",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

/**
 * Badge de statut — toujours pastille + libellé texte explicite.
 * Ne jamais coder l'information par la couleur seule (WCAG 1.4.1).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: UserStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    dot: "bg-slate-500",
    pill: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        config.pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

const ROLE_CONFIG: Record<string, { label: string; pill: string }> = {
  admin: {
    label: "Administrateur",
    pill: "bg-violet-50 text-violet-700 border-violet-200",
  },
  user: {
    label: "Utilisateur",
    pill: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

/** Badge de rôle — libellé texte explicite. */
export function RoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const config = ROLE_CONFIG[role] ?? {
    label: role,
    pill: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        config.pill,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * État de vérification email — toujours texte explicite.
 * Remplace les glyphes ✓/⏳ seuls (illisibles aux lecteurs d'écran).
 */
export function VerifiedBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-bold",
        verified ? "text-emerald-700" : "text-amber-700",
        className,
      )}
    >
      <span aria-hidden="true">{verified ? "✓" : "!"}</span>
      {verified ? "Vérifié" : "Non vérifié"}
    </span>
  );
}
