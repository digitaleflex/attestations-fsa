"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  RefreshCw,
  Search,
  Eye,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ExamOption {
  id: string;
  name?: string;
  title?: string;
}

interface SubmissionRow {
  id: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  totalScore: number;
  finalScore: number;
  maxScore: number;
  passed: boolean;
  completed: boolean;
  pendingReview: boolean;
  candidate: {
    id: string;
    name: string | null;
    email: string;
  };
  exam: {
    id: string;
    name?: string;
    title?: string;
    type: string;
  };
}

const STATUS_FILTERS = [
  { value: "ALL", label: "Tous les statuts" },
  { value: "PENDING_REVIEW", label: "À corriger" },
  { value: "GRADED", label: "Corrigées" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "PENDING", label: "En attente" },
] as const;

function formatDate(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(sub: SubmissionRow) {
  if (sub.completed) {
    return (
      <Badge className="border-none bg-emerald-100 text-emerald-700 font-bold">
        Corrigé
      </Badge>
    );
  }
  if (sub.pendingReview) {
    return (
      <Badge className="border-none bg-amber-100 text-amber-700 font-bold">
        À corriger
      </Badge>
    );
  }
  return (
    <Badge className="border-none bg-slate-100 text-slate-600 font-bold">
      {sub.status}
    </Badge>
  );
}

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [examFilter, setExamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const fetchSubmissions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/submissions");
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = (await res.json()) as { submissions?: SubmissionRow[] };
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch {
      toast.error("Impossible de charger les copies");
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch("/api/admin/exams");
        if (!res.ok) return;
        const data = (await res.json()) as ExamOption[];
        setExams(Array.isArray(data) ? data : []);
      } catch {
        // Les filtres restent utilisables sans la liste des examens.
      }
    };
    fetchExams();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (examFilter !== "ALL" && sub.exam.id !== examFilter) return false;
      if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
      if (query) {
        const name = sub.candidate.name?.toLowerCase() ?? "";
        const email = sub.candidate.email?.toLowerCase() ?? "";
        if (!name.includes(query) && !email.includes(query)) return false;
      }
      return true;
    });
  }, [submissions, examFilter, statusFilter, search]);

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-blue-600" />
            Copies à corriger
          </h1>
          <p className="text-slate-500 font-medium">
            Consultez les soumissions et procédez à la correction manuelle.
          </p>
        </div>
        <Button
          onClick={fetchSubmissions}
          variant="outline"
          className="h-11 rounded-xl font-bold border-slate-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Filtres */}
      <Card className="p-4 border-slate-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un candidat (nom, email)..."
              className="pl-10 h-11 rounded-xl bg-white border-slate-200"
            />
          </div>
          <div className="w-full lg:w-72">
            <Select value={examFilter} onValueChange={setExamFilter}>
              <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                <SelectValue placeholder="Tous les examens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les examens</SelectItem>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name || exam.title || "Examen"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full lg:w-56">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-bold">Chargement des copies...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-20 text-center border-dashed border-2 border-slate-200 bg-slate-50">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Aucune copie trouvée.</p>
        </Card>
      ) : (
        <Card className="border-slate-100 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Candidat
                </TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Examen
                </TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Soumis le
                </TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Score
                </TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Moyenne
                </TableHead>
                <TableHead className="font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Statut
                </TableHead>
                <TableHead className="text-right font-bold text-slate-500 uppercase text-[11px] tracking-wider">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <p className="font-bold text-slate-900">
                      {sub.candidate.name || "Candidat"}
                    </p>
                    <p className="text-xs text-slate-400">{sub.candidate.email}</p>
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {sub.exam.name || sub.exam.title || "Examen"}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {formatDate(sub.submittedAt || sub.startedAt)}
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">
                    {Math.round(sub.totalScore * 100) / 100}
                    <span className="text-slate-400">/{sub.maxScore}</span>
                  </TableCell>
                  <TableCell className="font-bold text-slate-700">
                    {sub.completed
                      ? `${(Math.round(sub.finalScore * 100) / 100).toFixed(2)}%`
                      : "--"}
                  </TableCell>
                  <TableCell>{statusBadge(sub)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                      <Link href={`/admin/submissions/${sub.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
                        Corriger
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
