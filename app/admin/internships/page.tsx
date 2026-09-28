"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Briefcase,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  ExternalLink,
  ChevronRight,
  Award,
  Plus,
  Download
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

type Request = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  university: string | null;
  level: string | null;
  position: string;
  cvUrl: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};

const statusMap: Record<string, { label: string, color: string }> = {
  'PENDING': { label: 'Nouveau', color: 'bg-blue-100 text-blue-700' },
  'REVIEWING': { label: 'En cours', color: 'bg-amber-100 text-amber-700' },
  'ACCEPTED': { label: 'Accepté', color: 'bg-emerald-100 text-emerald-700' },
  'REJECTED': { label: 'Refusé', color: 'bg-rose-100 text-rose-700' },
  'ARCHIVED': { label: 'Archivé', color: 'bg-slate-100 text-slate-700' },
};

export default function AdminInternshipsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Request | null>(null);
  const [filter, setFilter] = useState('ALL');
  // #267 — pagination serveur : la liste admin n'est plus « tout charger ».
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [attestModal, setAttestModal] = useState<Request | null>(null);
  const [attestForm, setAttestForm] = useState({
    startDate: '',
    endDate: '',
    instructor: 'Formateur Ferme St André',
    location: 'Abomey-Calavi',
    stageScore: '',
    stageObservations: 'Stage effectué avec succès.'
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, [page, filter, pageSize]);

  const fetchRequests = async () => {
    try {
      // #267 — filtre + pagination désormais gérés par l'API.
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter !== 'ALL') params.set('status', filter);
      const res = await fetch(`/api/admin/internships?${params.toString()}`);
      const data = await res.json();
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
      setTotal(typeof data?.pagination?.total === 'number' ? data.pagination.total : 0);
      setTotalPages(typeof data?.pagination?.totalPages === 'number' ? data.pagination.totalPages : 1);
    } catch (error) {
      toast.error("Erreur lors du chargement");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const changeFilter = (status: string) => {
    setFilter(status);
    setPage(1);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/internships/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Demande mise à jour: ${status}`);
        fetchRequests();
        setSelected(null);
      } else {
        // #267 — transition interdite / statut invalide : 400 explicite.
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Transition de statut refusée");
      }
    } catch (error) {
      toast.error("Erreur de mise à jour");
    }
  };

  const generateAttestation = async () => {
    if (!attestModal) return;
    if (!attestForm.startDate || !attestForm.endDate) {
        toast.error("Veuillez remplir les dates de début et fin.");
        return;
    }

    setIsGenerating(true);
    try {
      const { stageScore, ...rest } = attestForm;
      const body: Record<string, unknown> = { ...rest };
      if (stageScore !== '') body.stageScore = Number(stageScore);
      const res = await fetch(`/api/admin/internships/${attestModal.id}/attestation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Attestation générée : ${data.code}`);
        setAttestModal(null);
        fetchRequests();
      } else {
        throw new Error();
      }
    } catch (error) {
        toast.error("Erreur de génération d'attestation");
    } finally {
        setIsGenerating(false);
    }
  };

  // Le filtrage est désormais côté serveur (#267) : plus de filtre local.
  const filtered = requests;

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-8 space-y-6">        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestion des Stages</h1>
          <p className="text-slate-500">Gérez les demandes de stage entrants ({total}).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => {
                const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
                if (filter !== 'ALL') params.set('status', filter);
                window.open(`/api/admin/internships/export?${params.toString()}`, '_blank');
              }}
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
            {['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED', 'ARCHIVED'].map((s) => (
                <Button
                  key={s}
                  variant={filter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => changeFilter(s)}
                  className="h-9"
                >
                    {s === 'ALL' ? 'Tous' : statusMap[s].label}
                </Button>
            ))}
        </div>
      </div>

      {/* #267 — pagination serveur */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Page {page} sur {totalPages} — {total} demande{total > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <Card className="p-20 text-center flex flex-col items-center gap-4 border-dashed">
            <Briefcase className="w-12 h-12 text-slate-200" />
            <p className="text-slate-400 font-medium italic">Aucune demande trouvée.</p>
          </Card>
        ) : (
          filtered.map((r) => (
            <Card key={r.id} className="p-5 hover:shadow-md transition-all border-slate-100 group">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                      {r.fullName.charAt(0)}
                   </div>
                   <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800">{r.fullName}</h3>
                        <Badge className={`${statusMap[r.status].color} border-none`}>
                          {statusMap[r.status].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Briefcase className="w-3 h-3" /> {r.position}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="ghost" size="icon" aria-label="Voir la demande" className="h-11 w-11 hover:bg-brand/10 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setSelected(r)}>
                      <Eye className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="text-emerald-500 hover:bg-emerald-50" onClick={() => updateStatus(r.id, 'ACCEPTED')}>
                      <CheckCircle className="w-4 h-4" />
                   </Button>
                    <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50" onClick={() => updateStatus(r.id, 'REJECTED')}>
                      <XCircle className="w-4 h-4" />
                    </Button>
                    {r.status === 'ACCEPTED' && (
                        <Button
                         variant="ghost"
                         size="icon"
                         className="text-amber-500 hover:bg-amber-50"
                         onClick={() => setAttestModal(r)}
                         title="Délivrer attestation"
                        >
                            <Award className="w-4 h-4" />
                        </Button>
                    )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl p-0 border-none shadow-2xl">
          {selected && (
            <div className="relative">
              <div className="h-32 bg-gradient-to-r from-red-600 to-rose-700 p-8">
                  <div className="flex items-center gap-4 text-white">
                     <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-2xl border border-white/20">
                        {selected.fullName.charAt(0)}
                     </div>
                     <div>
                        <DialogTitle className="text-2xl font-black text-white">{selected.fullName}</DialogTitle>
                        <p className="opacity-80 text-sm font-medium">{selected.position} • {selected.level}</p>
                     </div>
                  </div>
              </div>

              <div className="p-4 sm:p-8 space-y-8 bg-white">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordonnées</h4>
                       <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <Mail className="w-4 h-4 text-rose-500" /> {selected.email}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <Phone className="w-4 h-4 text-rose-500" /> {selected.phone}
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cursus</h4>
                       <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <GraduationCap className="w-4 h-4 text-rose-500" /> {selected.university || 'Non précisé'}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600">
                             <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-[10px] uppercase">{selected.level}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       Message de motivation
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed italic">
                        "{selected.message || 'Aucun message.'}"
                    </p>
                 </div>

                 <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                      {selected.cvUrl && (
                        <Button variant="outline" className="gap-2 border-slate-200" onClick={() => window.open(selected.cvUrl!, '_blank')}>
                           <ExternalLink className="w-4 h-4" /> Voir le CV
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-3">
                       <Button variant="outline" onClick={() => updateStatus(selected.id, 'REVIEWING')}>
                          Mettre en examen
                       </Button>
                       <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(selected.id, 'ACCEPTED')}>
                          Accepter
                       </Button>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL GENERATION ATTESTATION */}
      <Dialog open={!!attestModal} onOpenChange={() => setAttestModal(null)}>
          <DialogContent className="max-w-md p-6">
              <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-brand" />
                    Générer une Attestation de Stage
                  </DialogTitle>
                  <DialogDescription>
                      Produire l'attestation officielle pour <strong>{attestModal?.fullName}</strong>.
                  </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Début du stage</label>
                          <input
                            type="date"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
                            value={attestForm.startDate}
                            onChange={(e) => setAttestForm({...attestForm, startDate: e.target.value})}
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Fin du stage</label>
                          <input
                            type="date"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
                            value={attestForm.endDate}
                            onChange={(e) => setAttestForm({...attestForm, endDate: e.target.value})}
                          />
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Lieu</label>
                      <input
                        type="text"
                        placeholder="Abomey-Calavi"
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={attestForm.location}
                        onChange={(e) => setAttestForm({...attestForm, location: e.target.value})}
                      />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Formateur / Responsable</label>
                      <input
                        type="text"
                        placeholder="Nom du responsable"
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={attestForm.instructor}
                        onChange={(e) => setAttestForm({...attestForm, instructor: e.target.value})}
                      />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Score (0-100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ex: 85"
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                        value={attestForm.stageScore}
                        onChange={(e) => setAttestForm({...attestForm, stageScore: e.target.value})}
                      />
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Observations</label>
                      <textarea
                        className="w-full p-2 border border-slate-200 rounded-lg text-sm min-h-[80px]"
                        value={attestForm.stageObservations}
                        onChange={(e) => setAttestForm({...attestForm, stageObservations: e.target.value})}
                      />
                  </div>
              </div>

              <div className="flex gap-2 mt-6">
                  <Button variant="outline" className="flex-1" onClick={() => setAttestModal(null)}>Annuler</Button>
                  <Button
                    className="flex-1 bg-brand hover:bg-brand-dark gap-2 text-white"
                    onClick={generateAttestation}
                    disabled={isGenerating}
                  >
                    {isGenerating ? <Loader2 className="animate-spin" /> : <Award className="w-4 h-4" />}
                    Générer
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
