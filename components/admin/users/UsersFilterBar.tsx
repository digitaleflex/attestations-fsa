import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UsersStatusFilter = "" | "ACTIVE" | "BLOCKED" | "SUSPENDED";
export type UsersRoleFilter = "" | "admin" | "user";
export type UsersVerifiedFilter = "" | "true" | "false";
export type UsersPeriodFilter = "" | "today" | "7d" | "30d";

export interface UsersFilters {
  q: string;
  status: UsersStatusFilter;
  role: UsersRoleFilter;
  verified: UsersVerifiedFilter;
  period: UsersPeriodFilter;
}

export const EMPTY_USERS_FILTERS: UsersFilters = {
  q: "",
  status: "",
  role: "",
  verified: "",
  period: "",
};

export function hasActiveUsersFilters(f: UsersFilters): boolean {
  return Boolean(f.q || f.status || f.role || f.verified || f.period);
}

export interface UsersFilterBarProps {
  filters: UsersFilters;
  loading?: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: UsersStatusFilter) => void;
  onRoleChange: (value: UsersRoleFilter) => void;
  onVerifiedChange: (value: UsersVerifiedFilter) => void;
  onPeriodChange: (value: UsersPeriodFilter) => void;
  onReset: () => void;
}

/**
 * Barre de filtres Apprenants : recherche + statut + rôle + vérification + période.
 * Tous les contrôles labellisés, cibles ≥ 44px, reset visible si filtres actifs.
 */
export function UsersFilterBar({
  filters,
  loading,
  onSearchChange,
  onStatusChange,
  onRoleChange,
  onVerifiedChange,
  onPeriodChange,
  onReset,
}: UsersFilterBarProps) {
  const hasActive = hasActiveUsersFilters(filters);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="users-search">Rechercher</Label>
        <div className="relative mt-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          />
          <Input
            id="users-search"
            type="search"
            value={filters.q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher par nom, email ou identifiant..."
            autoComplete="off"
            className="mt-1 pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="users-filter-status">Statut</Label>
          <Select
            value={filters.status || "all"}
            onValueChange={(v) =>
              onStatusChange(v === "all" ? "" : (v as UsersStatusFilter))
            }
            disabled={loading}
          >
            <SelectTrigger id="users-filter-status" className="mt-1 min-h-[44px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="ACTIVE">Actif</SelectItem>
              <SelectItem value="BLOCKED">Bloqué</SelectItem>
              <SelectItem value="SUSPENDED">Suspendu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="users-filter-role">Rôle</Label>
          <Select
            value={filters.role || "all"}
            onValueChange={(v) =>
              onRoleChange(v === "all" ? "" : (v as UsersRoleFilter))
            }
            disabled={loading}
          >
            <SelectTrigger id="users-filter-role" className="mt-1 min-h-[44px]">
              <SelectValue placeholder="Tous les rôles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="user">Utilisateur</SelectItem>
              <SelectItem value="admin">Administrateur</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="users-filter-verified">Vérification</Label>
          <Select
            value={filters.verified || "all"}
            onValueChange={(v) =>
              onVerifiedChange(v === "all" ? "" : (v as UsersVerifiedFilter))
            }
            disabled={loading}
          >
            <SelectTrigger id="users-filter-verified" className="mt-1 min-h-[44px]">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="true">Vérifié</SelectItem>
              <SelectItem value="false">Non vérifié</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="users-filter-period">Inscription</Label>
          <Select
            value={filters.period || "all"}
            onValueChange={(v) =>
              onPeriodChange(v === "all" ? "" : (v as UsersPeriodFilter))
            }
            disabled={loading}
          >
            <SelectTrigger id="users-filter-period" className="mt-1 min-h-[44px]">
              <SelectValue placeholder="Toutes dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="today">Aujourd&apos;hui</SelectItem>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActive && (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="min-h-[44px] gap-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Réinitialiser les filtres
          </Button>
        </div>
      )}
    </div>
  );
}
