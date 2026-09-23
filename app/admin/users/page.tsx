"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import { UserExamResults } from "@/components/exams/user-exam-results";
import { UserAuditLogs } from "@/components/admin/user-audit-logs";
import { User, UserStatus } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { StatusBadge, RoleBadge, VerifiedBadge } from "@/components/admin/users/UserBadges";
import { UserActionsMenu } from "@/components/admin/users/UserActionsMenu";
import {
  UsersFilterBar,
  hasActiveUsersFilters,
  type UsersFilters,
  type UsersPeriodFilter,
  type UsersRoleFilter,
  type UsersStatusFilter,
  type UsersVerifiedFilter,
} from "@/components/admin/users/UsersFilterBar";
import { UsersTableSkeleton } from "@/components/admin/users/UsersTableSkeleton";
import { UsersBulkBar, type BulkKind } from "@/components/admin/users/UsersBulkBar";
import { TableCaption } from "@/components/ui/table";
// ... (icons)
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  Eye,
  ShieldAlert,
  Unlock,
  KeyRound,
  History,
  Ban,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Users,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

type SortField = "name" | "email" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

const VALID_SORTS: SortField[] = ["name", "email", "createdAt", "updatedAt"];
const VALID_STATUS: UsersStatusFilter[] = ["", "ACTIVE", "BLOCKED", "SUSPENDED"];
const VALID_ROLES: UsersRoleFilter[] = ["", "admin", "user"];
const VALID_VERIFIED: UsersVerifiedFilter[] = ["", "true", "false"];
const VALID_PERIODS: UsersPeriodFilter[] = ["", "today", "7d", "30d"];

interface FiltersState extends UsersFilters {
  sort: SortField;
  direction: SortDirection;
  page: number;
}

const DEFAULT_FILTERS: FiltersState = {
  q: "",
  status: "",
  role: "",
  verified: "",
  period: "",
  sort: "createdAt",
  direction: "desc",
  page: 1,
};

/** Convertit le preset de période en intervalle ISO (filtre createdAt). */
function periodToRange(period: UsersPeriodFilter): { from?: string } {
  if (!period) return {};
  const now = new Date();
  if (period === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  const days = period === "7d" ? 7 : 30;
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString() };
}

const initialsOf = (u: User): string => {
  const base = (u.name || u.email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
};

const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-FR");
};

const formatDateTime = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR");
};

function RowCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <span className="flex h-11 w-11 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="h-5 w-5 shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
    </span>
  );
}

function SortButton({
  field,
  label,
  sort,
  direction,
  onToggle,
}: {
  field: SortField;
  label: string;
  sort: SortField;
  direction: SortDirection;
  onToggle: (field: SortField) => void;
}) {
  const active = sort === field;
  const next =
    !active || direction === "desc"
      ? "croissant"
      : direction === "asc"
        ? "décroissant"
        : "croissant";
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      aria-label={`Trier par ${label}, ordre ${next}`}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-left font-bold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {label}
      <span aria-hidden="true" className={active ? "text-brand" : "text-slate-400"}>
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
}

type UserForm = {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  address?: string;
};

type AdminExamOption = {
  id: string;
  title: string;
  name: string;
  status: string;
  scheduledAt?: string | null;
};

const toDatetimeLocal = (
  value: Date | string | null | undefined,
): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 20 });

  // Filtres lus depuis l'URL (source de vérité partageable)
  const rawStatus = searchParams.get("status") || "";
  const rawRole = searchParams.get("role") || "";
  const rawVerified = searchParams.get("verified") || "";
  const rawPeriod = searchParams.get("period") || "";
  const rawSort = searchParams.get("sort") || "";
  const rawDirection = searchParams.get("direction") || "";
  const filters: FiltersState = {
    q: searchParams.get("q") || "",
    status: (VALID_STATUS.includes(rawStatus as UsersStatusFilter)
      ? rawStatus
      : "") as UsersStatusFilter,
    role: (VALID_ROLES.includes(rawRole as UsersRoleFilter)
      ? rawRole
      : "") as UsersRoleFilter,
    verified: (VALID_VERIFIED.includes(rawVerified as UsersVerifiedFilter)
      ? rawVerified
      : "") as UsersVerifiedFilter,
    period: (VALID_PERIODS.includes(rawPeriod as UsersPeriodFilter)
      ? rawPeriod
      : "") as UsersPeriodFilter,
    sort: (VALID_SORTS.includes(rawSort as SortField)
      ? rawSort
      : "createdAt") as SortField,
    direction: rawDirection === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
  };
  const filtersKey = JSON.stringify(filters);

  const [search, setSearch] = useState(filters.q);
  const debouncedSearch = useDebounce(search, 500);

  // L'input suit l'URL (Back/Forward, reset) sans écraser la frappe en cours
  useEffect(() => {
    if (filters.q !== search && document.activeElement?.id !== "users-search") {
      setSearch(filters.q);
    }
  }, [filters.q]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [saving, setSaving] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewTab, setViewTab] = useState<"INFO" | "AUDIT">("INFO");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Affectation à un examen
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningUser, setAssigningUser] = useState<User | null>(null);
  const [exams, setExams] = useState<AdminExamOption[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [assignForm, setAssignForm] = useState<{
    examId: string;
    examScheduledAt: string;
  }>({ examId: "", examScheduledAt: "" });
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignRemoving, setAssignRemoving] = useState(false);

  // Miroir synchrone des filtres pour updateFilters (évite les closures périmées)
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Écrit les filtres dans l'URL (page réinitialisée sauf mention contraire)
  const updateFilters = useCallback(
    (next: Partial<FiltersState>) => {
      const merged: FiltersState = {
        ...filtersRef.current,
        ...next,
        page: next.page ?? 1,
      };
      const params = new URLSearchParams();
      if (merged.q) params.set("q", merged.q);
      if (merged.status) params.set("status", merged.status);
      if (merged.role) params.set("role", merged.role);
      if (merged.verified) params.set("verified", merged.verified);
      if (merged.period) params.set("period", merged.period);
      if (merged.sort !== "createdAt" || merged.direction !== "desc") {
        params.set("sort", merged.sort);
        params.set("direction", merged.direction);
      }
      if (merged.page > 1) params.set("page", String(merged.page));
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  const fetchUsers = useCallback(async () => {
    const f = filtersRef.current;
    setLoading(true);
    // La sélection appartient au jeu de résultats courant
    setSelectedIds([]);
    try {
      const params = new URLSearchParams();
      params.set("page", String(f.page));
      if (f.q) params.set("q", f.q);
      if (f.status) params.set("status", f.status);
      if (f.role) params.set("role", f.role);
      if (f.verified) params.set("verified", f.verified);
      const { from } = periodToRange(f.period);
      if (from) params.set("from", from);
      params.set("sort", f.sort);
      params.set("direction", f.direction);
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data.items) ? data.items : []);
      setMeta(data.meta || { total: 0, page: 1, totalPages: 1, limit: 20 });
      setLoadError(false);
    } catch (err) {
      console.error("[admin/users] chargement impossible:", err);
      setLoadError(true);
      toast.error("Impossible de charger les utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [filtersKey, fetchUsers]);

  // La recherche debouncée met à jour l'URL (qui déclenche le rechargement)
  useEffect(() => {
    if (debouncedSearch !== filtersRef.current.q) {
      updateFilters({ q: debouncedSearch });
    }
  }, [debouncedSearch, updateFilters]);

  const handleToggleSort = (field: SortField) => {
    const f = filtersRef.current;
    if (f.sort !== field) {
      updateFilters({ sort: field, direction: "asc" });
    } else if (f.direction === "asc") {
      updateFilters({ direction: "desc" });
    } else {
      updateFilters({ sort: "createdAt", direction: "desc" });
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    updateFilters({
      q: "",
      status: "",
      role: "",
      verified: "",
      period: "",
      sort: "createdAt",
      direction: "desc",
      page: 1,
    });
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        role: user.role as "admin" | "user",
        birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : "",
        birthPlace: user.birthPlace || "",
        phone: user.phone || "",
        address: user.address || "",
      });
    } else {
      setEditingUser(null);
      setForm({
        name: "",
        email: "",
        password: "",
        role: "user",
        birthDate: "",
        birthPlace: "",
        phone: "",
        address: "",
      });
    }
    setDialogOpen(true);
  };

  const handleViewDetails = (user: User) => {
    // Afficher les détails complets dans un dialog
    setViewingUser(user);
    setViewTab("INFO");
    setViewDialogOpen(true);
  };

  interface UserApiPayload {
    name: string;
    email: string;
    role: string;
    password?: string;
    birthDate?: Date;
    birthPlace?: string;
    phone?: string;
    address?: string;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const body: UserApiPayload = {
        name: form.name,
        email: form.email,
        role: form.role,
      };

      // Ajouter le mot de passe seulement si c'est un nouvel utilisateur ou si un nouveau est saisi
      if (!editingUser || form.password) {
        body.password = form.password;
      }

      // Ajouter les informations personnelles
      if (form.birthDate) body.birthDate = new Date(form.birthDate);
      if (form.birthPlace) body.birthPlace = form.birthPlace;
      if (form.phone) body.phone = form.phone;
      if (form.address) body.address = form.address;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur");
      }

      toast.success(editingUser ? "Utilisateur modifié" : "Utilisateur créé");
      setDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      console.error("[admin/users] enregistrement impossible:", err);
      toast.error("Impossible d'enregistrer cet utilisateur.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setUsers((prev) => prev.filter((u) => u.id !== deleteId));
      toast.success("Utilisateur supprimé");
    } catch (err: unknown) {
      console.error("[admin/users] suppression impossible:", err);
      toast.error("Impossible de supprimer cet utilisateur.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
      setDeleteConfirm("");
    }
  };

  const handleUpdateStatus = async (userId: string, status: UserStatus) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(status === 'ACTIVE' ? "Utilisateur réactivé" : "Utilisateur suspendu");
      fetchUsers();
      if (viewingUser) setViewingUser(prev => prev ? { ...prev, status } : null);
    } catch (err) {
      console.error("[admin/users] changement de statut impossible:", err);
      toast.error("Impossible de modifier le statut.");
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPasswordRequired: true }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Accès réinitialisé");
    } catch (err) {
      console.error("[admin/users] réinitialisation impossible:", err);
      toast.error("Impossible de réinitialiser l'accès.");
    }
  };

  const fetchExams = async () => {
    setExamsLoading(true);
    try {
      const res = await fetch("/api/admin/exams");
      if (!res.ok) throw new Error("Erreur lors du chargement des examens");
      const data = await res.json();
      setExams(Array.isArray(data) ? (data as AdminExamOption[]) : []);
    } catch (err) {
      console.error("[admin/users] chargement des examens impossible:", err);
      toast.error("Impossible de charger les examens.");
    } finally {
      setExamsLoading(false);
    }
  };

  const handleOpenAssignDialog = (user: User) => {
    setAssigningUser(user);
    setAssignForm({
      examId: user.examId || "",
      examScheduledAt: toDatetimeLocal(user.examScheduledAt),
    });
    setAssignDialogOpen(true);
    if (exams.length === 0 && !examsLoading) {
      fetchExams();
    }
  };

  const handleExamSelect = (value: string) => {
    setAssignForm((prev) => {
      if (!value) return { examId: "", examScheduledAt: "" };
      const selected = exams.find((e) => e.id === value);
      return {
        examId: value,
        examScheduledAt:
          prev.examScheduledAt || toDatetimeLocal(selected?.scheduledAt ?? null),
      };
    });
  };

  const handleSaveAssignment = async () => {
    if (!assigningUser) return;
    if (!assignForm.examId) {
      toast.error("Sélectionnez un examen à affecter");
      return;
    }
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/users/${assigningUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: assignForm.examId,
          examScheduledAt: assignForm.examScheduledAt
            ? new Date(assignForm.examScheduledAt).toISOString()
            : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Erreur");
      }
      toast.success("Affectation enregistrée");
      setAssignDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      console.error("[admin/users] affectation impossible:", err);
      toast.error("Impossible d'enregistrer l'affectation.");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!assigningUser) return;
    setAssignRemoving(true);
    try {
      const res = await fetch(`/api/users/${assigningUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: null, examScheduledAt: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Erreur");
      }
      toast.success("Affectation retirée");
      setAssignDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      console.error("[admin/users] retrait d'affectation impossible:", err);
      toast.error("Impossible de retirer l'affectation.");
    } finally {
      setAssignRemoving(false);
    }
  };

  // Le filtrage se fait côté serveur via fetchUsers() + URL
  const displayUsers = users;
  const hasActiveFilters = hasActiveUsersFilters({
    q: filters.q,
    status: filters.status,
    role: filters.role,
    verified: filters.verified,
    period: filters.period,
  });

  const deletingUser = users.find((u) => u.id === deleteId) ?? null;
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const handleDeleteRequest = (userId: string) => {
    setDeleteConfirm("");
    setDeleteId(userId);
  };

  // --- Sélection + actions groupées ---
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState<BulkKind | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState("");

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id),
    );
  };

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds(checked ? displayUsers.map((u) => u.id) : []);
  };

  const visibleIds = displayUsers.map((u) => u.id);
  const selectedVisible = visibleIds.filter((id) => selectedIds.includes(id));
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someVisibleSelected =
    selectedVisible.length > 0 && !allVisibleSelected;

  const bulkUsers = users.filter((u) => (bulkDeleteIds ?? []).includes(u.id));
  const bulkHasAdmin = bulkUsers.some((u) => u.role === "admin");

  async function patchStatusBulk(ids: string[], status: "ACTIVE" | "BLOCKED") {
    const verb = status === "ACTIVE" ? "réactivé" : "suspendu";
    setBulkBusy(status === "ACTIVE" ? "reactivate" : "suspend");
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = ids.length - ok;
      if (fail === 0) {
        toast.success(`${ok} utilisateur${ok > 1 ? "s" : ""} ${verb}`);
      } else {
        console.error("[admin/users] bulk statut partiel:", results);
        toast.error(`${ok} traité(s), ${fail} échec(s).`);
      }
      setSelectedIds([]);
      fetchUsers();
    } finally {
      setBulkBusy(null);
    }
  }

  const handleBulkAction = (kind: BulkKind) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (kind === "delete") {
      setBulkConfirm("");
      setBulkDeleteIds(ids);
      return;
    }
    patchStatusBulk(ids, kind === "reactivate" ? "ACTIVE" : "BLOCKED");
  };

  const handleBulkDelete = async () => {
    const ids = bulkDeleteIds ?? [];
    if (ids.length === 0) return;
    setBulkBusy("delete");
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/users/${id}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = ids.length - ok;
      if (fail === 0) {
        toast.success(`${ok} utilisateur${ok > 1 ? "s" : ""} supprimé${ok > 1 ? "s" : ""}`);
      } else {
        console.error("[admin/users] bulk suppression partielle:", results);
        toast.error(`${ok} supprimé(s), ${fail} échec(s).`);
      }
      setSelectedIds([]);
      setBulkDeleteIds(null);
      setBulkConfirm("");
      fetchUsers();
    } finally {
      setBulkBusy(null);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteId(null);
    setBulkDeleteIds(null);
    setDeleteConfirm("");
    setBulkConfirm("");
  };
  const visibleExams = exams.filter(
    (e) => e.status === "SCHEDULED" || e.status === "PUBLISHED",
  );
  const assignedExam = exams.find((e) => e.id === assigningUser?.examId);
  const currentExamLabel =
    assigningUser?.exam?.title ||
    assignedExam?.title ||
    assignedExam?.name ||
    assigningUser?.examId ||
    null;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation Apprenants / CRM */}
      <nav aria-label="Sections apprenants" className="flex gap-6 border-b border-slate-200">
        <Link href="/admin/users" aria-current="page" className="pb-3 text-sm font-bold text-brand border-b-2 border-brand flex items-center gap-2">
          <Users className="w-4 h-4" aria-hidden="true" /> Tous les utilisateurs
        </Link>
        <Link href="/admin/internships" className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2">
          Demandes de stage
        </Link>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Apprenants</h1>
          <p className="text-slate-500 mt-1">Gérez les comptes et profils des apprenants ({meta.total})</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2 w-full sm:w-auto min-h-[44px]">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Ajouter un apprenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">
                  Mot de passe {editingUser && "(laisser vide pour ne pas changer)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="role">Rôle</Label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as "admin" | "user" })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="user">Utilisateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Informations personnelles</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="birthDate">Date de naissance</Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="birthPlace">Lieu de naissance</Label>
                    <Input
                      id="birthPlace"
                      value={form.birthPlace}
                      onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                      placeholder="Ville, Pays"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+229 95 12 34 56"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Adresse (optionnel)</Label>
                    <Input
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Quartier, Rue..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 sticky bottom-0 bg-white">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  {editingUser ? "Modifier" : "Créer"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6 bg-white">
        <UsersFilterBar
          filters={{
            q: search,
            status: filters.status,
            role: filters.role,
            verified: filters.verified,
            period: filters.period,
          }}
          loading={loading}
          onSearchChange={setSearch}
          onStatusChange={(status) => updateFilters({ status })}
          onRoleChange={(role) => updateFilters({ role })}
          onVerifiedChange={(verified) => updateFilters({ verified })}
          onPeriodChange={(period) => updateFilters({ period })}
          onReset={handleResetFilters}
        />
      </Card>

      {/* Vue Bureau (Tableau) */}
      <Card className="bg-white hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="sr-only">
              Liste des apprenants — triable par nom, email et dates, actions par utilisateur
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-14">
                  <RowCheckbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    onChange={toggleAllVisible}
                    label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead scope="col" aria-sort={filters.sort === "name" ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton
                    field="name"
                    label="Nom"
                    sort={filters.sort}
                    direction={filters.direction}
                    onToggle={handleToggleSort}
                  />
                </TableHead>
                <TableHead scope="col" aria-sort={filters.sort === "email" ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton
                    field="email"
                    label="Email"
                    sort={filters.sort}
                    direction={filters.direction}
                    onToggle={handleToggleSort}
                  />
                </TableHead>
                <TableHead scope="col">Statut</TableHead>
                <TableHead scope="col">Rôle</TableHead>
                <TableHead scope="col">Vérifié</TableHead>
                <TableHead scope="col" aria-sort={filters.sort === "createdAt" ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton
                    field="createdAt"
                    label="Inscrit le"
                    sort={filters.sort}
                    direction={filters.direction}
                    onToggle={handleToggleSort}
                  />
                </TableHead>
                <TableHead scope="col" aria-sort={filters.sort === "updatedAt" ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <SortButton
                    field="updatedAt"
                    label="Activité"
                    sort={filters.sort}
                    direction={filters.direction}
                    onToggle={handleToggleSort}
                  />
                </TableHead>
                <TableHead scope="col" className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <UsersTableSkeleton />
                  </TableCell>
                </TableRow>
              ) : loadError && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <ErrorState
                      title="Impossible de charger les apprenants"
                      description="Une erreur est survenue lors du chargement des données."
                      onRetry={fetchUsers}
                    />
                  </TableCell>
                </TableRow>
              ) : displayUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState
                      title={hasActiveFilters ? "Aucun apprenant trouvé" : "Aucun apprenant"}
                      description={
                        hasActiveFilters
                          ? "Nous n'avons trouvé aucun utilisateur correspondant à vos critères."
                          : "Aucun compte apprenant pour le moment."
                      }
                      primaryAction={
                        hasActiveFilters
                          ? { label: "Réinitialiser les filtres", onClick: handleResetFilters }
                          : { label: "Ajouter un apprenant", onClick: () => handleOpenDialog() }
                      }
                      secondaryAction={
                        hasActiveFilters
                          ? { label: "Ajouter un apprenant", onClick: () => handleOpenDialog() }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                displayUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/60" data-selected={selectedIds.includes(u.id) || undefined}>
                    <TableCell>
                      <RowCheckbox
                        checked={selectedIds.includes(u.id)}
                        onChange={(checked) => toggleOne(u.id, checked)}
                        label={`Sélectionner ${u.name || u.email || "cet utilisateur"}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand-dark"
                        >
                          {initialsOf(u)}
                        </span>
                        {u.name || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-56 truncate" title={u.email || undefined}>{u.email || "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell>
                      <VerifiedBadge verified={Boolean(u.emailVerified)} />
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500" title={formatDateTime(u.updatedAt)}>
                      {formatDate(u.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => handleViewDetails(u)}
                          aria-label={`Voir ${u.name || u.email || "cet utilisateur"}`}
                          className="h-11 gap-2 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Voir
                        </Button>
                        <UserActionsMenu
                          user={u}
                          onView={handleViewDetails}
                          onEdit={handleOpenDialog}
                          onAssign={handleOpenAssignDialog}
                          onResetAccess={handleResetPassword}
                          onToggleStatus={handleUpdateStatus}
                          onDelete={handleDeleteRequest}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Desktop */}
        <div className="p-4 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Affichage de <span className="font-bold text-slate-700">{users.length}</span> sur <span className="font-bold text-slate-700">{meta.total}</span> utilisateurs
          </p>
          <nav aria-label="Pagination des apprenants" className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={meta.page <= 1 || loading}
              onClick={() => updateFilters({ page: meta.page - 1 })}
              aria-label="Page précédente"
              className="min-h-[44px] gap-1"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Précédent
            </Button>
            <div className="flex items-center gap-1 mx-2">
              <span className="text-xs font-medium text-slate-600" aria-live="polite">Page {meta.page} sur {meta.totalPages}</span>
            </div>
            <Button
              variant="outline"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => updateFilters({ page: meta.page + 1 })}
              aria-label="Page suivante"
              className="min-h-[44px] gap-1"
            >
              Suivant <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </Card>

      {/* Vue Mobile (Cartes) */}
      <div className="md:hidden space-y-4">
        {loading && users.length === 0 ? (
          <UsersTableSkeleton rows={3} />
        ) : loadError && users.length === 0 ? (
          <Card className="bg-white">
            <ErrorState
              title="Impossible de charger les apprenants"
              description="Une erreur est survenue lors du chargement des données."
              onRetry={fetchUsers}
            />
          </Card>
        ) : displayUsers.length === 0 ? (
          <Card className="bg-white">
            <EmptyState
              title={hasActiveFilters ? "Aucun apprenant trouvé" : "Aucun apprenant"}
              description={
                hasActiveFilters
                  ? "Nous n'avons trouvé aucun utilisateur correspondant à vos critères."
                  : "Aucun compte apprenant pour le moment."
              }
              primaryAction={
                hasActiveFilters
                  ? { label: "Réinitialiser les filtres", onClick: handleResetFilters }
                  : { label: "Ajouter un apprenant", onClick: () => handleOpenDialog() }
              }
              secondaryAction={
                hasActiveFilters
                  ? { label: "Ajouter un apprenant", onClick: () => handleOpenDialog() }
                  : undefined
              }
            />
          </Card>
        ) : (
          <>
            {displayUsers.map((u) => (
              <Card key={u.id} className="p-4 bg-white shadow-sm border-slate-100 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <RowCheckbox
                      checked={selectedIds.includes(u.id)}
                      onChange={(checked) => toggleOne(u.id, checked)}
                      label={`Sélectionner ${u.name || u.email || "cet utilisateur"}`}
                    />
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-black text-brand-dark"
                    >
                      {initialsOf(u)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 truncate">{u.name || "-"}</h3>
                      <p className="text-sm text-slate-500 truncate">{u.email || "-"}</p>
                    </div>
                  </div>
                  <UserActionsMenu
                    user={u}
                    onView={handleViewDetails}
                    onEdit={handleOpenDialog}
                    onAssign={handleOpenAssignDialog}
                    onResetAccess={handleResetPassword}
                    onToggleStatus={handleUpdateStatus}
                    onDelete={handleDeleteRequest}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Rôle</p>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Statut</p>
                    <div className="flex justify-end">
                      <StatusBadge status={u.status} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50">
                  <VerifiedBadge verified={Boolean(u.emailVerified)} />
                  <span className="text-[11px] text-slate-500">
                    Inscrit le {formatDate(u.createdAt)}
                  </span>
                </div>

                <Button
                  variant="outline"
                  onClick={() => handleViewDetails(u)}
                  aria-label={`Voir ${u.name || u.email || "cet utilisateur"}`}
                  className="w-full min-h-[44px] gap-2 font-bold"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Voir
                </Button>
              </Card>
            ))}

            {/* Pagination Mobile */}
            <nav aria-label="Pagination des apprenants" className="flex items-center justify-between pt-4 pb-8">
               <Button
                 variant="outline"
                 disabled={meta.page <= 1 || loading}
                 onClick={() => updateFilters({ page: meta.page - 1 })}
                 aria-label="Page précédente"
                 className="bg-white min-h-[44px]"
               >
                 <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Précédent
               </Button>
               <span className="text-xs font-bold text-slate-600" aria-live="polite">Page {meta.page} / {meta.totalPages}</span>
               <Button
                 variant="outline"
                 disabled={meta.page >= meta.totalPages || loading}
                 onClick={() => updateFilters({ page: meta.page + 1 })}
                 aria-label="Page suivante"
                 className="bg-white min-h-[44px]"
               >
                 Suivant <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
               </Button>
            </nav>
          </>
        )}
      </div>

      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent className="max-w-2xl bg-slate-900 text-white border border-white/10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tight text-white">
              Détails de l'utilisateur
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium italic">
              Informations complètes sur le profil candidat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {viewingUser && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-3xl border border-white/10 mb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${viewingUser.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {viewingUser.status === 'ACTIVE' ? <CheckCircle2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Statut du Compte</p>
                    <p className="font-bold text-white uppercase">{viewingUser.status === 'ACTIVE' ? 'Actif' : 'Bloqué'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {viewingUser.status === 'ACTIVE' ? (
                     <Button
                       onClick={() => handleUpdateStatus(viewingUser.id, 'BLOCKED')}
                       className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 px-4 rounded-xl text-xs gap-2"
                     >
                       <Ban className="w-4 h-4" /> Bloquer
                     </Button>
                   ) : (
                     <Button
                       onClick={() => handleUpdateStatus(viewingUser.id, 'ACTIVE')}
                       className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 rounded-xl text-xs gap-2"
                     >
                       <Unlock className="w-4 h-4" /> Débloquer
                     </Button>
                   )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                 <Button
                   variant="outline"
                   onClick={() => handleResetPassword(viewingUser.id)}
                   className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-12 rounded-2xl font-bold text-xs gap-2"
                 >
                   <KeyRound className="w-4 h-4 text-brand-light" /> Forcer Reset Password
                 </Button>
                 <Button
                   variant="outline"
                   onClick={() => setViewTab(viewTab === 'INFO' ? 'AUDIT' : 'INFO')}
                   className={`h-12 rounded-2xl font-bold text-xs gap-2 transition-all ${
                     viewTab === 'AUDIT'
                       ? 'bg-brand border-brand-light text-white shadow-lg shadow-brand/20'
                       : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                   }`}
                 >
                   <Activity className={`w-4 h-4 ${viewTab === 'AUDIT' ? 'text-white' : 'text-slate-400'}`} />
                   {viewTab === 'AUDIT' ? "Voir Profil Complet" : "Historique d'Audit"}
                 </Button>
              </div>

              {viewTab === 'INFO' ? (
                <>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Nom complet</p>
                      <p className="text-base font-bold text-white leading-tight">{viewingUser.name || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Email</p>
                      <p className="text-base font-bold text-white leading-tight">{viewingUser.email || "-"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Date de naissance</p>
                      <p className="text-base font-bold text-white leading-tight">
                        {viewingUser.birthDate ? new Date(viewingUser.birthDate).toLocaleDateString("fr-FR") : "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Lieu de naissance</p>
                      <p className="text-base font-bold text-white leading-tight">{viewingUser.birthPlace || "-"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Téléphone</p>
                      <p className="text-base font-bold text-white leading-tight">{viewingUser.phone || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Rôle</p>
                      <span
                        className={`inline-block text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${
                          viewingUser.role === "admin"
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-white/10 text-white border border-white/20 shadow-sm"
                        }`}
                      >
                        {viewingUser.role === "admin" ? "Administrateur" : "Utilisateur"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Adresse postale</p>
                    <p className="text-base font-bold text-white leading-tight">{viewingUser.address || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-6 border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Email vérifié</p>
                      <p className="text-base font-bold">
                        {viewingUser.emailVerified ? (
                          <span className="text-emerald-400 font-bold">Vérifié</span>
                        ) : (
                          <span className="text-amber-400 font-bold italic">Non vérifié</span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Créé le</p>
                      <p className="text-base font-bold text-slate-400">
                        {new Date(viewingUser.createdAt).toLocaleDateString("fr-FR", {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <UserExamResults userId={viewingUser.id} />
                  </div>
                </>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <UserAuditLogs userId={viewingUser.id} />
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter className="pt-6">
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl h-11 px-6 font-bold transition-all">
              Fermer
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Affecter un examen</DialogTitle>
          </DialogHeader>

          {assigningUser && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Candidat :{" "}
                <span className="font-medium text-slate-800">
                  {assigningUser.name || assigningUser.email || assigningUser.id}
                </span>
              </p>

              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Affectation actuelle
                </p>
                {assigningUser.examId ? (
                  <>
                    <p className="font-medium text-slate-800">
                      {currentExamLabel}
                    </p>
                    <p className="text-slate-500">
                      {assigningUser.examScheduledAt
                        ? new Date(assigningUser.examScheduledAt).toLocaleString(
                            "fr-FR",
                          )
                        : "Aucun créneau défini"}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500 italic">
                    Aucun examen affecté
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="assign-exam">Examen</Label>
                <Select
                  value={assignForm.examId}
                  onValueChange={handleExamSelect}
                >
                  <SelectTrigger id="assign-exam" className="mt-1">
                    <SelectValue
                      placeholder={
                        examsLoading
                          ? "Chargement..."
                          : "Sélectionner un examen"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleExams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title || exam.name} (
                        {exam.status === "PUBLISHED" ? "Publié" : "Planifié"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {visibleExams.length === 0 && !examsLoading && (
                  <p className="text-xs text-amber-600 mt-1">
                    Aucun examen visible (SCHEDULED / PUBLISHED).
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="assign-scheduled">
                  Créneau (date et heure) — optionnel
                </Label>
                <Input
                  id="assign-scheduled"
                  type="datetime-local"
                  value={assignForm.examScheduledAt}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      examScheduledAt: e.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveAssignment}
                  disabled={assignRemoving || !assigningUser.examId}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  {assignRemoving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Retirer l&apos;affectation
                </Button>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssignDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveAssignment}
                    disabled={assignSaving}
                  >
                    {assignSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Enregistrer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId || !!bulkDeleteIds} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" aria-hidden="true" />
              {bulkDeleteIds ? `Supprimer ${bulkDeleteIds.length} utilisateur${bulkDeleteIds.length > 1 ? "s" : ""} ?` : "Supprimer cet utilisateur ?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Cette action supprimera définitivement {bulkDeleteIds ? <>les {bulkDeleteIds.length} comptes sélectionnés</> : <>le compte{deletingUser ? <> de <strong>{deletingUser.name || deletingUser.email}</strong></> : " de l'utilisateur"}</>} ainsi que les données associées.
              <span className="block mt-2 font-bold text-rose-600 underline">Les données d&apos;examen et l&apos;historique seront perdus.</span>
              {(deletingUser?.role === "admin" || bulkHasAdmin) && (
                <span className="mt-3 block rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-bold text-amber-800">
                  Attention : la sélection contient un compte administrateur. Pour confirmer,
                  saisissez {bulkDeleteIds ? "« SUPPRIMER »" : "son adresse email"} ci-dessous.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(deletingUser?.role === "admin" || bulkHasAdmin) && (
            <div className="mt-2">
              <Label htmlFor={bulkDeleteIds ? "bulk-delete-confirm" : "delete-confirm-email"}>
                Confirmation{bulkDeleteIds ? " — saisissez SUPPRIMER" : " — adresse email du compte"}
              </Label>
              {bulkDeleteIds ? (
                <Input
                  id="bulk-delete-confirm"
                  type="text"
                  autoComplete="off"
                  value={bulkConfirm}
                  onChange={(e) => setBulkConfirm(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="mt-1"
                />
              ) : (
                <Input
                  id="delete-confirm-email"
                  type="text"
                  autoComplete="off"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deletingUser?.email || ""}
                  className="mt-1"
                />
              )}
            </div>
          )}
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel
              disabled={isDeleting || bulkBusy === "delete"}
              onClick={closeDeleteDialog}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 min-h-[44px]"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (bulkDeleteIds) handleBulkDelete();
                else handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              disabled={
                isDeleting ||
                bulkBusy === "delete" ||
                (bulkDeleteIds
                  ? bulkHasAdmin && bulkConfirm.trim() !== "SUPPRIMER"
                  : deletingUser?.role === "admin" && deleteConfirm.trim().toLowerCase() !== (deletingUser.email || "").toLowerCase())
              }
            >
              {(isDeleting || bulkBusy === "delete") ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Suppression en cours...
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UsersBulkBar
        count={selectedIds.length}
        busy={bulkBusy}
        onAction={handleBulkAction}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
}
