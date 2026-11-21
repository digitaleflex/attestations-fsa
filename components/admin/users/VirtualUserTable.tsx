"use client";

import React, { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, UserStatus } from "@/types";
import { StatusBadge, RoleBadge, VerifiedBadge } from "./UserBadges";
import { UserActionsMenu } from "./UserActionsMenu";
import { Eye } from "lucide-react";

type SortField = "name" | "email" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

function initialsOf(u: User): string {
  const base = (u.name || u.email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-FR");
}

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
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      aria-label={`Trier par ${label}`}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-left font-bold uppercase tracking-wider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {label}
      <span aria-hidden="true" className={active ? "text-brand" : "text-slate-400"}>
        {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

export interface VirtualUserTableProps {
  users: User[];
  selectedIds?: string[];
  onToggleOne?: (id: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
  sort?: SortField | string;
  direction?: SortDirection | string;
  onToggleSort?: (field: SortField) => void;
  onView?: (user: User) => void;
  onEdit?: (user: User) => void;
  onAssign?: (user: User) => void;
  onResetAccess?: (userId: string) => void;
  onToggleStatus?: (userId: string, status: UserStatus) => void;
  onDelete?: (userId: string) => void;
  allVisibleSelected?: boolean;
  someVisibleSelected?: boolean;
}

export function VirtualUserTable({
  users,
  selectedIds = [],
  onToggleOne = () => {},
  onToggleAll = () => {},
  sort = "createdAt",
  direction = "desc",
  onToggleSort = () => {},
  onView,
  onEdit,
  onAssign,
  onResetAccess,
  onToggleStatus,
  onDelete,
  allVisibleSelected = false,
  someVisibleSelected = false,
}: VirtualUserTableProps) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const handleView = (u: User) => {
    if (onView) onView(u);
    else router.push(`/admin/users/${u.id}`);
  };

  return (
    <Card className="bg-white hidden lg:block overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="flex items-center border-b bg-slate-50 px-2 py-2 text-xs font-bold uppercase text-slate-500">
            <div className="w-14">
              <RowCheckbox
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                onChange={onToggleAll}
                label="Tout sélectionner"
              />
            </div>
            <div className="flex-1"><SortButton field="name" label="Nom" sort={sort as SortField} direction={direction as SortDirection} onToggle={onToggleSort as (f: SortField) => void} /></div>
            <div className="hidden 2xl:block flex-1"><SortButton field="email" label="Email" sort={sort as SortField} direction={direction as SortDirection} onToggle={onToggleSort as (f: SortField) => void} /></div>
            <div className="w-24">Statut</div>
            <div className="w-24">Rôle</div>
            <div className="w-24">Vérifié</div>
            <div className="w-28"><SortButton field="createdAt" label="Inscrit le" sort={sort as SortField} direction={direction as SortDirection} onToggle={onToggleSort as (f: SortField) => void} /></div>
            <div className="hidden xl:block w-28"><SortButton field="updatedAt" label="Activité" sort={sort as SortField} direction={direction as SortDirection} onToggle={onToggleSort as (f: SortField) => void} /></div>
            <div className="w-32 text-right">Actions</div>
          </div>

          <div ref={parentRef} style={{ height: "600px", overflow: "auto" }}>
            <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const u = users[vi.index];
                return (
                  <div
                    key={vi.key}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${vi.start}px)`,
                    }}
                    className="flex items-center border-b px-2 py-2 hover:bg-slate-50/60"
                    data-selected={selectedIds.includes(u.id) || undefined}
                  >
                    <div className="w-14">
                      <RowCheckbox
                        checked={selectedIds.includes(u.id)}
                        onChange={(checked) => onToggleOne(u.id, checked)}
                        label={`Sélectionner ${u.name || u.email || "cet utilisateur"}`}
                      />
                    </div>
                    <div className="flex-1 font-medium">
                      <span className="flex items-center gap-2.5" title={u.email || undefined}>
                        <span
                          aria-hidden="true"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand-dark"
                        >
                          {initialsOf(u)}
                        </span>
                        {u.name || "-"}
                      </span>
                    </div>
                    <div className="hidden 2xl:block flex-1 max-w-56 truncate" title={u.email || undefined}>{u.email || "-"}</div>
                    <div className="w-24 whitespace-nowrap"><StatusBadge status={u.status} /></div>
                    <div className="w-24 whitespace-nowrap"><RoleBadge role={u.role} /></div>
                    <div className="w-24 whitespace-nowrap"><VerifiedBadge verified={Boolean(u.emailVerified)} /></div>
                    <div className="w-28 text-sm text-slate-500">{formatDate(u.createdAt)}</div>
                    <div className="hidden xl:block w-28 text-sm text-slate-500" title={formatDate(u.updatedAt)}>{formatDate(u.updatedAt)}</div>
                    <div className="w-32 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          onClick={() => handleView(u)}
                          aria-label={`Voir ${u.name || u.email || "cet utilisateur"}`}
                          className="h-11 gap-2 px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Voir
                        </Button>
                        <UserActionsMenu
                          user={u}
                          onView={(user) => handleView(user)}
                          onEdit={onEdit || (() => {})}
                          onAssign={onAssign || (() => {})}
                          onResetAccess={onResetAccess || (() => {})}
                          onToggleStatus={onToggleStatus || (() => {})}
                          onDelete={onDelete || (() => {})}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default VirtualUserTable;
