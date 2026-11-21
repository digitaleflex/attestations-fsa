"use client";

import { useEffect, useState } from "react";
import { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface UserForm {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  address?: string;
}

export interface UserCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: User | null;
  saving?: boolean;
  onSubmit: (form: UserForm) => void | Promise<void>;
}

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "user",
  birthDate: "",
  birthPlace: "",
  phone: "",
  address: "",
};

export function UserCreateDialog({
  open,
  onOpenChange,
  editingUser,
  saving,
  onSubmit,
}: UserCreateDialogProps) {
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setForm({
          name: editingUser.name || "",
          email: editingUser.email || "",
          password: "",
          role: (editingUser.role as "admin" | "user") || "user",
          birthDate: editingUser.birthDate
            ? new Date(editingUser.birthDate).toISOString().split("T")[0]
            : "",
          birthPlace: editingUser.birthPlace || "",
          phone: editingUser.phone || "",
          address: editingUser.address || "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editingUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
