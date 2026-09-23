import * as React from "react";
import {
  Eye,
  Edit,
  CalendarClock,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/types";

export interface UserActionsMenuProps {
  user: User;
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onAssign: (user: User) => void;
  onResetAccess: (userId: string) => void;
  onToggleStatus: (userId: string, next: "ACTIVE" | "BLOCKED") => void;
  onDelete: (userId: string) => void;
  /** Nom affiché dans l'aria-label du déclencheur. */
  label?: string;
  align?: "start" | "end";
}

/**
 * Menu d'actions par utilisateur.
 * Action primaire (Voir) + menu « … » pour le secondaire.
 * Déclencheur 44×44, items 44px min, clavier natif Radix (flèches + ESC).
 */
export function UserActionsMenu({
  user,
  onView,
  onEdit,
  onAssign,
  onResetAccess,
  onToggleStatus,
  onDelete,
  label,
  align = "end",
}: UserActionsMenuProps) {
  const triggerLabel =
    label ?? `Actions pour ${user.name || user.email || "cet utilisateur"}`;
  const isBlocked = user.status !== "ACTIVE";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          className="h-11 w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-56">
        <DropdownMenuItem
          onSelect={() => onView(user)}
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-medium"
        >
          <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Voir
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onEdit(user)}
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-medium"
        >
          <Edit className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onAssign(user)}
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-medium"
        >
          <CalendarClock className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Affecter un examen
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onResetAccess(user.id)}
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-medium"
        >
          <KeyRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
          Réinitialiser l&apos;accès
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            onToggleStatus(user.id, isBlocked ? "ACTIVE" : "BLOCKED")
          }
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-medium"
        >
          {isBlocked ? (
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <Ban className="h-4 w-4 text-amber-600" aria-hidden="true" />
          )}
          {isBlocked ? "Réactiver" : "Suspendre"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDelete(user.id)}
          className="min-h-[44px] cursor-pointer gap-3 text-sm font-bold text-rose-700 focus:text-rose-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
