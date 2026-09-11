"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
}

type ContactStatus = "READ" | "UNREAD";

const TYPE_OPTIONS = [
  { value: "ALL", label: "Tous les types" },
  { value: "FORMATION_INSCRIPTION", label: "Inscriptions formations" },
  { value: "CONTACT", label: "Contact" },
  { value: "RDV", label: "Rendez-vous" },
  { value: "SUPPORT", label: "Support" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "UNREAD", label: "Non lus" },
  { value: "READ", label: "Lus" },
];

const TYPE_META: Record<string, { label: string; className: string }> = {
  FORMATION_INSCRIPTION: {
    label: "Inscription formation",
    className: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  CONTACT: {
    label: "Contact",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  RDV: {
    label: "Rendez-vous",
    className: "bg-amber-50 text-amber-700 border-amber-100",
  },
  SUPPORT: {
    label: "Support",
    className: "bg-sky-50 text-sky-700 border-sky-100",
  },
};

function getTypeMeta(type: string) {
  return (
    TYPE_META[type] ?? {
      label: type.replace(/_/g, " ").toLowerCase(),
      className: "bg-slate-100 text-slate-600 border-slate-200",
    }
  );
}

function getStatusMeta(status: string) {
  if (status === "READ") {
    return {
      label: "Lu",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
      dot: "bg-emerald-500",
    };
  }
  if (status === "UNREAD") {
    return {
      label: "Non lu",
      className: "bg-rose-50 text-rose-700 border-rose-100",
      dot: "bg-rose-500",
    };
  }
  return {
    label: status.replace(/_/g, " ").toLowerCase(),
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminContactsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const queryKey = ["admin-contacts", typeFilter, statusFilter];

  const { data, isLoading, isError, isFetching, refetch } =
    useQuery<ContactsResponse>({
      queryKey,
      queryFn: async () => {
        const params = new URLSearchParams({ limit: "100" });
        if (typeFilter !== "ALL") params.set("type", typeFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);

        const res = await fetch(`/api/admin/contacts?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Impossible de charger les demandes.");
        }
        return (await res.json()) as ContactsResponse;
      },
    });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ContactStatus;
    }) => {
      const res = await fetch("/api/admin/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        throw new Error("La mise à jour du statut a échoué.");
      }
      return (await res.json()) as Contact;
    },
    onSuccess: (_updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setDetailContact((current) =>
        current && current.id === variables.id
          ? { ...current, status: variables.status }
          : current
      );
      toast.success(
        variables.status === "READ"
          ? "Demande marquée comme lue"
          : "Demande marquée comme non lue"
      );
    },
    onError: () => {
      toast.error("Impossible de mettre à jour le statut de la demande.");
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/admin/contacts?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error("La suppression a échoué.");
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
      setDeleteTarget(null);
      setDetailContact(null);
      toast.success("Demande supprimée");
    },
    onError: () => {
      toast.error("Impossible de supprimer la demande.");
    },
  });

  const contacts = data?.contacts ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) => {
      const haystack = [contact.name, contact.email, contact.subject ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [contacts, search]);

  const unreadCount = contacts.filter((c) => c.status === "UNREAD").length;

  const handleToggleStatus = (contact: Contact) => {
    updateStatus.mutate({
      id: contact.id,
      status: contact.status === "READ" ? "UNREAD" : "READ",
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="space-y-2">
        <Badge className="bg-slate-900 text-white border-none px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
          Messagerie
        </Badge>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-lg">
            <Inbox className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Messages et demandes
            </h1>
            <p className="text-slate-500 font-medium">
              Consultez les inscriptions aux formations et les messages reçus.
            </p>
          </div>
        </div>
      </header>

      <Card className="p-4 md:p-5 border-slate-100 shadow-sm rounded-2xl">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_200px] md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Rechercher une demande"
              placeholder="Rechercher par nom, email ou sujet..."
              className="pl-9 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-slate-900"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              aria-label="Filtrer par type de demande"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
            >
              <SelectValue placeholder="Type de demande" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              aria-label="Filtrer par statut"
              className="h-11 rounded-xl border-slate-200 bg-slate-50/50"
            >
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs font-medium text-slate-500">
            {filtered.length} demande{filtered.length > 1 ? "s" : ""} affichée
            {filtered.length > 1 ? "s" : ""}
            {isFetching && !isLoading ? " · actualisation..." : ""}
          </p>
          {unreadCount > 0 && (
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={index}
              className="p-6 rounded-2xl border-slate-100 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="p-16 text-center border-dashed border-2 bg-rose-50/40 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-rose-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">
            Une erreur est survenue
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Les demandes n&apos;ont pas pu être chargées.
          </p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="rounded-xl font-semibold"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-20 text-center border-dashed border-2 bg-slate-50/50 rounded-2xl">
          <Inbox className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-400">
            Aucune demande à afficher
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            Modifiez les filtres ou la recherche pour élargir les résultats.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((contact) => {
            const typeMeta = getTypeMeta(contact.type);
            const statusMeta = getStatusMeta(contact.status);
            const isUnread = contact.status === "UNREAD";
            const isUpdating =
              updateStatus.isPending && updateStatus.variables?.id === contact.id;

            return (
              <Card
                key={contact.id}
                className={cn(
                  "p-6 rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden",
                  isUnread ? "bg-white" : "bg-slate-50/60"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 left-0 h-full w-1.5",
                    isUnread ? "bg-rose-500" : "bg-emerald-500"
                  )}
                />

                <div className="flex flex-col gap-4 pl-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className={cn(
                            "text-lg tracking-tight truncate",
                            isUnread
                              ? "font-black text-slate-900"
                              : "font-bold text-slate-700"
                          )}
                        >
                          {contact.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5",
                            typeMeta.className
                          )}
                        >
                          {typeMeta.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={`mailto:${contact.email}`}
                            className="hover:text-slate-900 hover:underline"
                          >
                            {contact.email}
                          </a>
                        </span>
                        {contact.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <a
                              href={`tel:${contact.phone}`}
                              className="hover:text-slate-900 hover:underline"
                            >
                              {contact.phone}
                            </a>
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 shrink-0 inline-flex items-center gap-1.5",
                        statusMeta.className
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          statusMeta.dot
                        )}
                      />
                      {statusMeta.label}
                    </Badge>
                  </div>

                  {contact.subject && (
                    <p className="text-sm font-semibold text-slate-700">
                      {contact.subject}
                    </p>
                  )}

                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                    {contact.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Reçu le {formatDate(contact.createdAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailContact(contact)}
                        className="rounded-lg font-semibold text-slate-600 hover:text-slate-900"
                      >
                        <Eye className="w-4 h-4" />
                        Voir le message
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(contact)}
                        disabled={isUpdating}
                        className="rounded-lg font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isUnread ? (
                          <MailOpen className="w-4 h-4" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        {isUnread ? "Marquer comme lu" : "Marquer comme non lu"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(contact)}
                        className="rounded-lg font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={detailContact !== null}
        onOpenChange={(open) => {
          if (!open) setDetailContact(null);
        }}
      >
        <DialogContent className="max-w-2xl rounded-2xl">
          {detailContact && (
            <>
              <DialogHeader className="space-y-3 pr-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5",
                      getTypeMeta(detailContact.type).className
                    )}
                  >
                    {getTypeMeta(detailContact.type).label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-2.5 py-1",
                      getStatusMeta(detailContact.status).className
                    )}
                  >
                    {getStatusMeta(detailContact.status).label}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black text-slate-900 text-left">
                  {detailContact.subject || "Demande sans sujet"}
                </DialogTitle>
                <DialogDescription className="text-left">
                  Reçu le {formatDate(detailContact.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-semibold">{detailContact.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <a
                    href={`mailto:${detailContact.email}`}
                    className="hover:underline"
                  >
                    {detailContact.email}
                  </a>
                </div>
                {detailContact.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={`tel:${detailContact.phone}`}
                      className="hover:underline"
                    >
                      {detailContact.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  {formatDate(detailContact.createdAt)}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Message
                </p>
                <div className="max-h-[40vh] overflow-y-auto rounded-xl bg-slate-900 text-slate-100 p-5 text-sm leading-relaxed whitespace-pre-wrap">
                  {detailContact.message}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleToggleStatus(detailContact)}
                  disabled={
                    updateStatus.isPending &&
                    updateStatus.variables?.id === detailContact.id
                  }
                  className="rounded-xl font-semibold"
                >
                  {detailContact.status === "READ" ? (
                    <Mail className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {detailContact.status === "READ"
                    ? "Marquer comme non lu"
                    : "Marquer comme lu"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(detailContact)}
                  className="rounded-xl font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer cette demande ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La demande de{" "}
              <span className="font-semibold text-slate-700">
                {deleteTarget?.name}
              </span>{" "}
              sera définitivement supprimée. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-semibold">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteContact.mutate(deleteTarget.id);
              }}
              disabled={deleteContact.isPending}
              className="rounded-xl font-semibold bg-rose-600 hover:bg-rose-700"
            >
              {deleteContact.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
