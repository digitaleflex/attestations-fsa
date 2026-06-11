"use client";

import { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";
import Link from "next/link";
import { UserExamResults } from "@/components/exams/user-exam-results";
import { UserAuditLogs } from "@/components/admin/user-audit-logs";
import { User, UserStatus } from "@/types";
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
  ChevronRight
} from "lucide-react";

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

export default function AdminUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1, limit: 20 });
  
  // Lecture des filtres depuis l'URL
  const queryPage = parseInt(searchParams.get("page") || "1");
  const querySearch = searchParams.get("q") || "";

  const [search, setSearch] = useState(querySearch);
  const debouncedSearch = useDebounce(search, 500);

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

  // Mettre à jour l'URL quand les filtres changent
  const updateFilters = useCallback((newPage: number, newSearch: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) params.set("page", newPage.toString());
    else params.delete("page");
    
    if (newSearch) params.set("q", newSearch);
    else params.delete("q");

    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    fetchUsers(queryPage, querySearch);
  }, [queryPage, querySearch]);

  // Déclencher la mise à jour de l'URL quand la recherche debouncée change
  useEffect(() => {
    if (debouncedSearch !== querySearch) {
      updateFilters(1, debouncedSearch);
    }
  }, [debouncedSearch, querySearch, updateFilters]);

  const fetchUsers = async (page: number, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?page=${page}&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setUsers(Array.isArray(data.items) ? data.items : []);
      setMeta(data.meta || { total: 0, page: 1, totalPages: 1, limit: 20 });
    } catch (err) {
      toast.error("Échec du chargement des utilisateurs");
    } finally {
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

      toast.success(editingUser ? "Utilisateur modifié !" : "Utilisateur créé !");
      setDialogOpen(false);
      fetchUsers(queryPage, querySearch);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
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
      toast.success("Utilisateur supprimé !");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
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
      toast.success(status === 'ACTIVE' ? "Utilisateur débloqué !" : "Utilisateur bloqué !");
      fetchUsers(queryPage, querySearch);
      if (viewingUser) setViewingUser(prev => prev ? { ...prev, status } : null);
    } catch (err) {
      toast.error("Échec de la mise à jour du statut");
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
      toast.success("Réinitialisation forcée activée !");
    } catch (err) {
      toast.error("Échec de la réinitialisation");
    }
  };

  // Le filtrage se fait maintenant côté serveur via fetchUsers(queryPage, querySearch)
  const displayUsers = users;

  return (
    <div className="p-6 space-y-6">
      {/* Navigation Apprenants / CRM */}
      <div className="flex gap-6 border-b border-slate-200">
        <Link href="/admin/users" className="pb-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2">
          <Users className="w-4 h-4" /> Tous les utilisateurs
        </Link>
        <Link href="/admin/internships" className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2">
          Demandes de stage
        </Link>
        <Link href="/admin/waitlist" className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2">
          Liste d'attente
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Utilisateurs</h1>
          <p className="text-slate-500 mt-1">Gérez les comptes utilisateurs ({meta.total})</p>
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
        <div className="w-full md:w-96">
          <Label htmlFor="search">Rechercher</Label>
          <div className="relative">
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou email..."
              className="mt-1 pr-10"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
          </div>
        </div>
      </Card>

      {/* Vue Bureau (Tableau) */}
      <Card className="bg-white hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Vérifié</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-500 mt-2">Chargement...</p>
                  </TableCell>
                </TableRow>
              ) : displayUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                  </TableCell>
                </TableRow>
              ) : (
                displayUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || "-"}</TableCell>
                    <TableCell>{u.email || "-"}</TableCell>
                    <TableCell>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Actif" : "Bloqué"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.role === "admin" ? "Administrateur" : "Utilisateur"}
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
                          onClick={() => setDeleteId(u.id)}
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
        
        {/* Pagination Desktop */}
        <div className="p-4 border-t flex items-center justify-between bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Affichage de <span className="font-bold text-slate-700">{users.length}</span> sur <span className="font-bold text-slate-700">{meta.total}</span> utilisateurs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => updateFilters(meta.page - 1, querySearch)}
              className="h-8 gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </Button>
            <div className="flex items-center gap-1 mx-2">
              <span className="text-xs font-medium text-slate-600">Page {meta.page} sur {meta.totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => updateFilters(meta.page + 1, querySearch)}
              className="h-8 gap-1"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Vue Mobile (Cartes) */}
      <div className="md:hidden space-y-4">
        {loading && users.length === 0 ? (
          <div className="text-center py-8">
            <Loader2 className="animate-spin w-6 h-6 mx-auto text-slate-400" />
            <p className="text-sm text-slate-500 mt-2">Chargement...</p>
          </div>
        ) : displayUsers.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-slate-100 text-slate-500">
            {search ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
          </div>
        ) : (
          <>
            {displayUsers.map((u) => (
              <Card key={u.id} className="p-4 bg-white shadow-sm border-slate-100 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-800">{u.name || "-"}</h3>
                    <p className="text-sm text-slate-500">{u.email || "-"}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleViewDetails(u)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(u)}>
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(u.id)} className="text-rose-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rôle</p>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0">
                      {u.role === "admin" ? "Admin" : "Élève"}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Statut</p>
                    <div className="flex justify-end">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}
                      >
                        {u.status === "ACTIVE" ? "Actif" : "Bloqué"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-50">
                   <div className="flex items-center gap-1">
                     <Users className="w-3 h-3" />
                     {u.phone || "Pas de tel"}
                   </div>
                   <div>
                     {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                   </div>
                </div>
              </Card>
            ))}

            {/* Pagination Mobile */}
            <div className="flex items-center justify-between pt-4 pb-8">
               <Button
                 variant="outline"
                 size="sm"
                 disabled={meta.page <= 1 || loading}
                 onClick={() => updateFilters(meta.page - 1, querySearch)}
                 className="bg-white"
               >
                 <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
               </Button>
               <span className="text-xs font-bold text-slate-600">Page {meta.page} / {meta.totalPages}</span>
               <Button
                 variant="outline"
                 size="sm"
                 disabled={meta.page >= meta.totalPages || loading}
                 onClick={() => updateFilters(meta.page + 1, querySearch)}
                 className="bg-white"
               >
                 Suivant <ChevronRight className="w-4 h-4 ml-1" />
               </Button>
            </div>
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
                   <KeyRound className="w-4 h-4 text-blue-400" /> Forcer Reset Password
                 </Button>
                 <Button
                   variant="outline"
                   onClick={() => setViewTab(viewTab === 'INFO' ? 'AUDIT' : 'INFO')}
                   className={`h-12 rounded-2xl font-bold text-xs gap-2 transition-all ${
                     viewTab === 'AUDIT'
                       ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                       : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                   }`}
                 >
                   <Activity className={`w-4 h-4 ${viewTab === 'AUDIT' ? 'text-white' : 'text-amber-400'}`} />
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
                          <span className="text-emerald-400">✓ Oui</span>
                        ) : (
                          <span className="text-amber-400 italic">⏳ Non</span>
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
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" />
              Supprimer l'utilisateur ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Cette action supprimera définitivement le compte de l'utilisateur.
              <span className="block mt-2 font-bold text-rose-600 underline">Ses données d'examen et son historique seront perdus.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                "Confirmer la suppression"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
