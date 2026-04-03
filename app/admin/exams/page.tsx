"use client";

import { useEffect, useState } from "react";
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
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  ClipboardCheck, 
  Calendar,
  Clock,
  MoreVertical,
  CheckCircle2,
  XCircle,
  History
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Exam = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  scheduledAt: string | null;
  totalPoints: number;
  createdAt: string;
  _count: {
    submissions: number;
  };
};

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch("/api/exams");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setExams(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exams/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      setExams((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success("Examen supprimé !");
    } catch (err: any) {
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const statusConfig = {
    DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Edit },
    PUBLISHED: { label: "Publié", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    SCHEDULED: { label: "Programmé", color: "bg-blue-100 text-blue-700", icon: Calendar },
    ARCHIVED: { label: "Archivé", color: "bg-amber-100 text-amber-700", icon: History },
  };

  const filteredExams = exams.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Examens</h1>
          <p className="text-slate-500 mt-1">Gérez les examens et leur publication</p>
        </div>
        <Link href="/admin/exams/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvel examen
          </Button>
        </Link>
      </div>

      <Card className="p-6 bg-white">
        <div className="w-full md:w-96">
          <Label htmlFor="search">Rechercher</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titre de l'examen..."
            className="mt-1"
          />
        </div>
      </Card>

      <Card className="bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Candidats</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-500 mt-2">Chargement...</p>
                  </TableCell>
                </TableRow>
              ) : filteredExams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {search ? "Aucun examen trouvé" : "Aucun examen créé"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExams.map((exam) => {
                  const StatusIcon = statusConfig[exam.status].icon;
                  return (
                    <TableRow key={exam.id} className="hover:bg-slate-50">
                      <TableCell className="font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-slate-400" />
                          {exam.title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${statusConfig[exam.status].color} gap-1 font-medium`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[exam.status].label}
                        </Badge>
                        {exam.status === 'SCHEDULED' && exam.scheduledAt && (
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(exam.scheduledAt).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-700">{exam.totalPoints} pts</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-slate-500">
                          {exam._count.submissions} inscrits
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(exam.createdAt).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/exams/${exam.id}/edit`}>
                            <Button variant="ghost" size="sm" title="Modifier">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/submissions?examId=${exam.id}`}>Voir les résultats</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteId(exam.id)}
                                className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                              >
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-white border-2 border-slate-100 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-xl">
              <Trash2 className="w-6 h-6" />
              Supprimer cet examen ?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Toutes les questions et configurations liées à cet examen seront supprimées du système. 
              <span className="block mt-2 font-bold text-rose-600 underline">Cette action ne peut pas être annulée.</span>
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
