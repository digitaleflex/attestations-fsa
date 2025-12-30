"use client";
import * as React from "react";
import { useEffect, useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import "@/components/ui/input-style.css";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, Eye, Pencil, Trash2, FileDown, Download, Copy, Search, CheckCircle2, Clock, XCircle, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { useInfiniteQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AttestationsListPage() {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const LIMIT = 20;

  // Infinite Query pour les attestations
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch
  } = useInfiniteQuery({
    queryKey: ['attestations', search],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/attestations?limit=${LIMIT}&order=desc&offset=${pageParam}&search=${encodeURIComponent(search)}`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < LIMIT) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  const attestations = data ? data.pages.flat() : [];

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const option = { root: null, rootMargin: '20px', threshold: 1.0 };
    const observer = new window.IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => { if (loaderRef.current) observer.unobserve(loaderRef.current); };
  }, [handleObserver]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/attestations/${id}`, { method: 'DELETE' });
      refetch();
      setShowConfirm(null);
      toast.success("Attestation supprimée avec succès !");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingId(null);
    }
  };

  const getExportData = () => {
    return attestations.map((a) => ({
      Code: a.code,
      "Nom complet": a.fullName,
      Formation: a.formation?.name || "-",
      Type: a.type,
      "Date émission": a.issuedAt ? new Date(a.issuedAt).toLocaleDateString('fr-FR') : "-",
      Status: a.status
    }));
  };

  const exportCSV = () => {
    const data = getExportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "attestations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export CSV généré !");
  };

  const exportExcel = () => {
    const data = getExportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attestations");
    XLSX.writeFile(workbook, "attestations.xlsx");
    toast.success("Export Excel généré !");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Code", "Nom complet", "Formation", "Type", "Date", "Status"];
    const tableRows = attestations.map((a) => [
      a.code,
      a.fullName,
      a.formation?.name || "-",
      a.type,
      a.issuedAt ? new Date(a.issuedAt).toLocaleDateString('fr-FR') : "-",
      a.status
    ]);

    doc.text("Liste des Attestations", 14, 15);
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [67, 56, 202] }, // Indigo-700
    });
    doc.save("attestations.pdf");
    toast.success("Export PDF généré !");
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
  };

  // Status Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    let styles = "bg-slate-100 text-slate-600 border-slate-200";
    let icon = null;

    if (status === 'VALIDATED') {
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20";
      icon = <CheckCircle2 className="w-3 h-3 mr-1" />;
    } else if (status === 'PENDING') {
      styles = "bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20";
      icon = <Clock className="w-3 h-3 mr-1" />;
    } else if (status === 'REJECTED') {
      styles = "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20";
      icon = <XCircle className="w-3 h-3 mr-1" />;
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ring-1 ring-inset ${styles}`}>
        {icon}
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Attestations</h1>
          <p className="text-slate-500 mt-1">Gérez et suivez toutes les attestations délivrées.</p>
        </div>
        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-white/50 backdrop-blur-sm border-slate-200 hover:bg-white hover:text-indigo-600 transition-all shadow-sm">
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Choisir le format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportCSV}>
                <FileText className="w-4 h-4 mr-2" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}>
                <FileDown className="w-4 h-4 mr-2" /> PDF (Liste)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all" asChild>
            <a href="/admin/attestations/new">Nouvelle Attestation</a>
          </Button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="glass-panel rounded-2xl p-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100/50 bg-white/40 backdrop-blur-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <Input
              className="pl-10 h-10 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all rounded-xl"
              placeholder="Rechercher par nom, code, formation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {attestations.length} résultats affichés
          </div>
        </div>

        <div className="relative overflow-x-auto min-h-[400px] bg-white/30">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : attestations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Search className="w-8 h-8 opacity-50" />
              </div>
              <p className="font-medium">Aucune attestation trouvée.</p>
              <p className="text-sm">Essayez de modifier vos critères de recherche.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 pl-6">Code</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Bénéficiaire</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Formation</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Type</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Date</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Statut</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attestations.map((a) => (
                  <TableRow key={a.id} className="group hover:bg-indigo-50/30 transition-colors border-slate-100">
                    <TableCell className="font-mono text-xs font-medium text-slate-600 pl-6">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-1 rounded text-[11px]">{a.code.slice(-5)}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button onClick={() => handleCopy(a.code)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-indigo-100 rounded text-indigo-500">
                                <Copy className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Copier le code complet</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{a.fullName}</TableCell>
                    <TableCell className="text-slate-600 max-w-[200px] truncate" title={a.formation?.name}>{a.formation?.name || "-"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {a.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500 text-xs">{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg" asChild>
                                <a href={`/admin/attestations/${a.id}`}>
                                  <Eye className="w-4 h-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Détail</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-100 hover:text-amber-700 rounded-lg" asChild>
                                <a href={`/admin/attestations/${a.id}/edit`}>
                                  <Pencil className="w-4 h-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg"
                                asChild
                              >
                                <a href={`/admin/attestations/${a.id}?pdf=1`} target="_blank" rel="noopener noreferrer">
                                  <FileDown className="w-4 h-4" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Télécharger PDF</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-rose-100 hover:text-rose-700 rounded-lg"
                                disabled={deletingId === a.id}
                                onClick={() => setShowConfirm(a.id)}
                              >
                                {deletingId === a.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {/* Dialogue de confirmation inline */}
                      {showConfirm === a.id && (
                        <div className="absolute right-12 z-50 bg-white shadow-xl border border-slate-200 rounded-lg p-4 w-64 animate-in fade-in zoom-in-95 duration-200">
                          <h4 className="text-sm font-semibold text-slate-900 mb-1">Confirmer ?</h4>
                          <p className="text-xs text-slate-500 mb-3">Cette action est irréversible.</p>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowConfirm(null)}>Annuler</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(a.id)}>Supprimer</Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div ref={loaderRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="text-center py-4 bg-white/50 border-t border-slate-100">
              <Loader2 className="animate-spin mx-auto w-5 h-5 text-indigo-500" />
              <span className="text-xs text-slate-400 mt-1 block">Chargement...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}