"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Edit, Ban, Unlock, KeyRound, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";

export function UserProfileActions({ user }: { user: { id: string; status: string; name?: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const patch = async (body: any, success: string) => {
    setBusy(JSON.stringify(body));
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy("delete");
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Utilisateur supprimé");
      router.push("/admin/users");
    } catch {
      toast.error("Suppression impossible.");
    } finally {
      setBusy(null);
    }
  };

  const isActive = user.status === "ACTIVE";

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/users/${user.id}/edit`}>
        <Button variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          Modifier
        </Button>
      </Link>
      {isActive ? (
        <Button
          variant="outline"
          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
          disabled={busy !== null}
          onClick={() => patch({ status: "SUSPENDED" }, "Utilisateur suspendu")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          Suspendre
        </Button>
      ) : (
        <Button
          variant="outline"
          className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          disabled={busy !== null}
          onClick={() => patch({ status: "ACTIVE" }, "Utilisateur réactivé")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
          Réactiver
        </Button>
      )}
      <Button
        variant="outline"
        className="gap-2"
        disabled={busy !== null}
        onClick={() => patch({ resetPasswordRequired: true }, "Accès réinitialisé")}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Reset password
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="gap-2" disabled={busy !== null}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tapez le nom pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={user.name || ""}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirm !== (user.name || "")}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}