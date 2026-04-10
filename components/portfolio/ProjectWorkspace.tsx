"use client";

import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Trophy, 
  BookOpen, 
  Link as LinkIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronRight,
  Info
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Proof {
  id: string;
  label: string;
  url: string;
  type: string;
  createdAt: string;
}

interface ProjectWorkspaceProps {
  mission: any;
  onBack: () => void;
  onUpdate: () => void;
}

export default function ProjectWorkspace({ mission, onBack, onUpdate }: ProjectWorkspaceProps) {
  const [proofs, setProofs] = useState<Proof[]>(mission.proofs || []);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    fetchChat();
    // Polling pour le chat spécifique au projet
    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [mission.id]);

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/chat?missionId=${mission.id}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {}
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.label || !newLink.url) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/user/portfolio/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: mission.id,
          label: newLink.label,
          url: newLink.url
        })
      });

      if (res.ok) {
        const saved = await res.json();
        setProofs(prev => [...prev, saved]);
        setNewLink({ label: "", url: "" });
        setIsAddingLink(false);
        toast.success("Lien ajouté avec succès");
        onUpdate();
      }
    } catch (err) {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("Supprimer ce lien ?")) return;
    try {
      const res = await fetch(`/api/user/portfolio/proofs?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setProofs(prev => prev.filter(p => p.id !== id));
        toast.success("Lien supprimé");
        onUpdate();
      }
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isChatLoading) return;
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          missionId: mission.id
        })
      });

      if (res.ok) {
        const msg = await res.json();
        setChatMessages(prev => [...prev, msg]);
        setNewMessage("");
      }
    } catch (err) {
      toast.error("Échec de l'envoi");
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack} className="w-fit gap-2 -ml-2 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour au portfolio
        </Button>
        <div className="flex items-center gap-3">
            <Badge className={mission.unlockedLevel === 'ADVANCED' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                Niveau {mission.unlockedLevel === 'ADVANCED' ? 'Avancé' : 'Standard'}
            </Badge>
            <Badge className={mission.userStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>
                {mission.userStatus === 'COMPLETED' ? 'Validé' : 'En cours'}
            </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Guide & Proofs */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Card */}
          <Card className="p-8 border-none shadow-premium bg-white">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group shadow-inner">
                <Trophy className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-black text-slate-900 leading-tight">{mission.title}</h1>
                <p className="text-slate-500 mt-1 font-medium italic">{mission.formationName}</p>
              </div>
            </div>

            {/* Guide Section */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" /> Guide de mise en œuvre
              </h2>
              <div className="prose prose-slate prose-sm max-w-none bg-slate-50 p-6 rounded-3xl border border-slate-100 leading-relaxed text-slate-700">
                {mission.guideMarkdown ? (
                  <ReactMarkdown>{mission.guideMarkdown}</ReactMarkdown>
                ) : (
                  <p className="italic text-slate-400">Aucun guide spécifique n'est disponible pour ce projet.</p>
                )}
              </div>
            </div>

            <hr className="my-10 border-slate-100" />

            {/* Submissions Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-emerald-400" /> Preuves & Livrables (Drive)
                </h2>
                <Button onClick={() => setIsAddingLink(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl gap-1 text-[10px] font-bold h-8">
                    <Plus className="w-3 h-3" /> Ajouter un lien
                </Button>
              </div>

              {/* Driving Warning */}
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                <p className="text-[11px] text-rose-700 font-medium leading-normal">
                    <span className="font-black uppercase mr-1">Alerte critique :</span> 
                    Ne supprimez jamais vos fichiers de votre Google Drive après les avoir liés ici. 
                    Si le lien est rompu, votre portfolio sera incomplet et votre validation pourra être annulée.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proofs.map((proof) => (
                  <div key={proof.id} className="group p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <ExternalLink className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-800 truncate">{proof.label}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteLink(proof.id)} className="h-8 w-8 text-slate-300 hover:text-rose-600 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ajouté le {format(new Date(proof.createdAt), 'dd MMMM', { locale: fr })}</span>
                        <a href={proof.url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest flex items-center gap-1">
                            Ouvrir <ChevronRight className="w-3 h-3" />
                        </a>
                    </div>
                  </div>
                ))}

                {isAddingLink && (
                  <form onSubmit={handleAddLink} className="p-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 space-y-3 animate-in zoom-in-95 duration-300">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-emerald-600 ml-1">Nom du document</label>
                        <Input 
                            autoFocus
                            placeholder="Ex: Business Plan Final" 
                            className="h-8 rounded-lg border-none bg-white text-xs shadow-sm"
                            value={newLink.label}
                            onChange={(e) => setNewLink({...newLink, label: e.target.value})}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-emerald-600 ml-1">Lien Google Drive (Public)</label>
                        <Input 
                            placeholder="https://drive.google.com/..." 
                            className="h-8 rounded-lg border-none bg-white text-xs shadow-sm"
                            value={newLink.url}
                            onChange={(e) => setNewLink({...newLink, url: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button type="submit" disabled={isSubmitting} size="sm" className="flex-1 bg-emerald-600 h-8 rounded-lg font-bold text-[10px]">
                            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmer"}
                        </Button>
                        <Button type="button" onClick={() => setIsAddingLink(false)} variant="ghost" size="sm" className="h-8 rounded-lg text-[10px] text-slate-400">Annuler</Button>
                    </div>
                  </form>
                )}

                {proofs.length === 0 && !isAddingLink && (
                  <div className="md:col-span-2 h-32 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center opacity-40">
                    <LinkIcon className="w-6 h-6 text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aucune preuve liée pour le moment</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Col: Mentor Chat & Status */}
        <div className="space-y-6">
            {/* Status Card */}
            <Card className="p-6 border-none shadow-premium bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Trophy className="w-24 h-24" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Statut Projet</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mission.userStatus === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                            {mission.userStatus === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-black">{mission.userStatus === 'COMPLETED' ? 'Projet Validé' : 'Mise en œuvre'}</p>
                            <p className="text-[10px] text-slate-400">{mission.userStatus === 'COMPLETED' ? 'Félicitations !' : 'Action de l\'apprenant requise'}</p>
                        </div>
                    </div>
                    {mission.adminComment && (
                        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 italic text-[11px] text-slate-300">
                            "{mission.adminComment}"
                        </div>
                    )}
                </div>
            </Card>

            {/* Mentor Chat */}
            <Card className="flex flex-col h-[450px] border-none shadow-premium bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-50 bg-indigo-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Assistance Mentorat</span>
                    </div>
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                
                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                            <Send className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-[10px] font-bold text-slate-500">Posez vos questions techniques ici.</p>
                        </div>
                    ) : (
                        chatMessages.map((m: any) => {
                            const isMe = m.senderRole === "user";
                            return (
                                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] ${
                                        isMe ? 'bg-slate-900 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                    }`}>
                                        <p className="leading-relaxed">{m.content}</p>
                                        <p className={`text-[8px] mt-1 font-bold ${isMe ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {format(new Date(m.createdAt), 'HH:mm')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-50 flex gap-2">
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Votre question..." 
                        className="h-10 rounded-xl bg-slate-50 border-none text-[11px] focus:ring-1 focus:ring-indigo-100"
                    />
                    <Button type="submit" disabled={isChatLoading || !newMessage.trim()} size="icon" className="h-10 w-10 shrink-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
                        {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </form>
            </Card>
        </div>
      </div>
    </div>
  );
}
