"use client";

import React, { useState, useEffect } from "react";
import { User, UserStatus } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserExamResults } from "@/components/exams/user-exam-results";
import { UserAuditLogs } from "@/components/admin/user-audit-logs";
import { StatusBadge, RoleBadge, VerifiedBadge } from "@/components/admin/users/UserBadges";
import {
  Ban,
  Unlock,
  KeyRound,
  Activity,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  Clock,
  History as HistoryIcon,
} from "lucide-react";

export interface UserDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onToggleStatus?: (userId: string, status: UserStatus) => void | Promise<void>;
  onResetPassword?: (userId: string) => void | Promise<void>;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-800 leading-tight break-words">
        {value ?? "-"}
      </p>
    </div>
  );
}

export function UserDetailDialog({
  open,
  onOpenChange,
  user,
  onToggleStatus,
  onResetPassword,
}: UserDetailDialogProps) {
  const [viewTab, setViewTab] = useState<"INFO" | "AUDIT">("INFO");

  useEffect(() => {
    if (open) setViewTab("INFO");
  }, [open, user?.id]);

  if (!user) return null;

  const viewingUser = user;

  const initials = (viewingUser.name || viewingUser.email || "?")
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Indicateur de présence : dérivé du statut et de la dernière activité.
  const presence =
    viewingUser.status !== "ACTIVE"
      ? { online: false, label: "Hors ligne" }
      : (() => {
          const last = viewingUser.updatedAt
            ? new Date(viewingUser.updatedAt).getTime()
            : 0;
          const recent = last > 0 && Date.now() - last < 24 * 60 * 60 * 1000;
          return recent
            ? { online: true, label: "En ligne" }
            : { online: false, label: "Hors ligne" };
        })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl [&>button]:text-slate-500 [&>button]:hover:bg-slate-100">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight text-slate-800">
            Détails de l&apos;utilisateur
          </DialogTitle>
          <DialogDescription className="font-medium italic text-slate-500">
            Informations complètes sur le profil candidat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* En-tête identité + présence */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
                  {initials}
                </div>
                <span
                  className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                    presence.online ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-slate-800">
                  {viewingUser.name || "Sans nom"}
                </p>
                <p className="truncate text-sm font-medium text-slate-500">
                  {viewingUser.email || "-"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={viewingUser.status} />
                  <RoleBadge role={viewingUser.role} />
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                      presence.online ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        presence.online ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                      aria-hidden="true"
                    />
                    {presence.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewingUser.status === "ACTIVE" ? (
                <Button
                  onClick={() => onToggleStatus?.(viewingUser.id, "BLOCKED")}
                  className="h-10 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 gap-2"
                >
                  <Ban className="h-4 w-4" /> Bloquer
                </Button>
              ) : (
                <Button
                  onClick={() => onToggleStatus?.(viewingUser.id, "ACTIVE")}
                  className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 gap-2"
                >
                  <Unlock className="h-4 w-4" /> Débloquer
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => onResetPassword?.(viewingUser.id)}
              className="h-12 rounded-2xl border-slate-200 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 gap-2"
            >
              <KeyRound className="h-4 w-4 text-brand" /> Forcer Reset Password
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewTab(viewTab === "INFO" ? "AUDIT" : "INFO")}
              className={`h-12 rounded-2xl text-xs font-bold gap-2 transition-all ${
                viewTab === "AUDIT"
                  ? "border-brand bg-brand text-white shadow-lg shadow-brand/20 hover:bg-brand"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              <Activity className={`h-4 w-4 ${viewTab === "AUDIT" ? "text-white" : "text-slate-500"}`} />
              {viewTab === "AUDIT" ? "Voir Profil Complet" : "Historique d'Audit"}
            </Button>
          </div>

          {viewTab === "INFO" ? (
            <>
              {/* Identité */}
              <Section title="Identité" icon={UserIcon}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nom complet" value={viewingUser.name || "-"} />
                  <Field
                    label="Rôle"
                    value={<RoleBadge role={viewingUser.role} />}
                  />
                  <Field
                    label="Date de naissance"
                    value={
                      viewingUser.birthDate
                        ? new Date(viewingUser.birthDate).toLocaleDateString("fr-FR")
                        : "-"
                    }
                  />
                  <Field label="Lieu de naissance" value={viewingUser.birthPlace || "-"} />
                </div>
              </Section>

              {/* Coordonnées */}
              <Section title="Coordonnées" icon={Mail}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email" value={viewingUser.email || "-"} />
                  <Field
                    label="Téléphone"
                    value={
                      viewingUser.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {viewingUser.phone}
                        </span>
                      ) : (
                        "-"
                      )
                    }
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Adresse postale"
                      value={
                        viewingUser.address ? (
                          <span className="inline-flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                            {viewingUser.address}
                          </span>
                        ) : (
                          "-"
                        )
                      }
                    />
                  </div>
                </div>
              </Section>

              {/* Statut */}
              <Section title="Statut" icon={ShieldCheck}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Statut du compte"
                    value={<StatusBadge status={viewingUser.status} />}
                  />
                  <Field
                    label="Email vérifié"
                    value={<VerifiedBadge verified={!!viewingUser.emailVerified} />}
                  />
                  <Field
                    label="Créé le"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {new Date(viewingUser.createdAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    }
                  />
                  <Field
                    label="Dernière activité"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {viewingUser.updatedAt
                          ? new Date(viewingUser.updatedAt).toLocaleDateString("fr-FR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </span>
                    }
                  />
                </div>
                {viewingUser.formationId && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <Field label="Formation" value={viewingUser.formationId} />
                  </div>
                )}
                {(viewingUser.examScheduledAt || viewingUser.exam) && (
                  <div className="mt-4 border-t border-slate-100 pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {viewingUser.exam && (
                      <Field
                        label="Examen assigné"
                        value={viewingUser.exam.title || viewingUser.exam.name || "-"}
                      />
                    )}
                    {viewingUser.examScheduledAt && (
                      <Field
                        label="Date d'examen prévue"
                        value={new Date(viewingUser.examScheduledAt).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      />
                    )}
                  </div>
                )}
              </Section>

              {/* Historique / Résultats */}
              <Section title="Historique" icon={HistoryIcon}>
                <div className="space-y-4">
                  <UserExamResults userId={viewingUser.id} />
                </div>
              </Section>
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Section title="Historique d'audit" icon={Activity}>
                <UserAuditLogs userId={viewingUser.id} />
              </Section>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 px-6 font-bold text-slate-800 transition-all hover:bg-slate-100 hover:text-slate-800"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}