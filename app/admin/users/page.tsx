"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Plus, Edit, Trash2, UserPlus, Eye } from "lucide-react";
import { toast } from "sonner";
import { UserExamResults } from "@/components/exams/user-exam-results";

type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  emailVerified: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  address?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>({
    name: "",
    email: "",
    password: "",
    role: "USER",
  });
  const [saving, setSaving] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setForm({
        name: user.name || "",
        email: user.email || "",
        password: "",
        role: user.role as "ADMIN" | "USER",
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
        role: "USER",
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
    setViewDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const body: any = { 
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

      toast.success(editingUser ? "Utilisateur modifié !" : "Utilisateur créé !");
      setDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Utilisateur supprimé !");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Utilisateurs</h1>
          <p className="text-slate-500 mt-1">Gérez les comptes utilisateurs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Nouvel utilisateur
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
                    setForm({ ...form, role: e.target.value as "ADMIN" | "USER" })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md"
                >
                  <option value="USER">Utilisateur</option>
                  <option value="ADMIN">Administrateur</option>
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
        <div className="w-full md:w-96">
          <Label htmlFor="search">Rechercher</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou email..."
            className="mt-1"
          />
        </div>
      </Card>

      <Card className="bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Vérifié</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-500 mt-2">Chargement...</p>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || "-"}</TableCell>
                    <TableCell>{u.email || "-"}</TableCell>
                    <TableCell>{u.phone || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          u.role === "ADMIN"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {u.emailVerified ? (
                        <span className="text-emerald-600" title="Email vérifié">✓</span>
                      ) : (
                        <span className="text-amber-600" title="En attente">⏳</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(u)}
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(u)}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(u.id)}
                          className="text-rose-600 hover:text-rose-700"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog pour voir les détails complets */}
      <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">
              Détails de l'utilisateur
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              Informations complètes sur l'utilisateur
            </AlertDialogDescription>
          </AlertDialogHeader>
          {viewingUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Nom complet</p>
                  <p className="text-base text-slate-900">{viewingUser.name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Email</p>
                  <p className="text-base text-slate-900">{viewingUser.email || "-"}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Date de naissance</p>
                  <p className="text-base text-slate-900">
                    {viewingUser.birthDate ? new Date(viewingUser.birthDate).toLocaleDateString("fr-FR") : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Lieu de naissance</p>
                  <p className="text-base text-slate-900">{viewingUser.birthPlace || "-"}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Téléphone</p>
                  <p className="text-base text-slate-900">{viewingUser.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Rôle</p>
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                      viewingUser.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {viewingUser.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-slate-500">Adresse postale</p>
                <p className="text-base text-slate-900">{viewingUser.address || "-"}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-slate-500">Email vérifié</p>
                  <p className="text-base">
                    {viewingUser.emailVerified ? (
                      <span className="text-emerald-600">✓ Oui</span>
                    ) : (
                      <span className="text-amber-600">⏳ Non</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Créé le</p>
                  <p className="text-base text-slate-900">
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
              
              <UserExamResults userId={viewingUser.id} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
