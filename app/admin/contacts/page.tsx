"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Mail, Phone, Calendar, User, Search, Filter, Trash2, 
  CheckCheck, MessageSquare, Clock, ArrowRight, ShieldCheck, MailQuestion
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchContacts();
  }, [filter]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/admin/contacts" : `/api/admin/contacts?status=${filter}`;
      const data = await apiFetch(url);
      setContacts(data.contacts || []);
    } catch (error) {
      toast.error("Échec du chargement des messages");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await apiFetch("/api/admin/contacts", {
        method: "PATCH",
        body: JSON.stringify({ id, status: newStatus }),
      });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success("Statut mis à jour");
    } catch (error) {
      toast.error("Erreur mise à jour");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce message ?")) return;
    try {
      await apiFetch(`/api/admin/contacts?id=${id}`, { method: "DELETE" });
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success("Message supprimé");
    } catch (error) {
      toast.error("Erreur suppression");
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">📬 Messages & RDV</h1>
            <p className="text-slate-500 font-medium">Gérez les demandes de contact et les prises de rendez-vous publiques.</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
             {["all", "UNREAD", "READ", "ARCHIVED"].map((f) => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    {f === "all" ? "Tous" : f === "UNREAD" ? "Non lus" : f === "READ" ? "Lus" : "Archivés"}
                </button>
             ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 bg-white border-none shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Mail className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Messages</p>
                      <p className="text-2xl font-black text-slate-900">{contacts.length}</p>
                   </div>
                </div>
            </Card>
            <Card className="p-6 bg-white border-none shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Calendar className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prises de RDV</p>
                      <p className="text-2xl font-black text-slate-900">{contacts.filter(c => c.subject === "rdv").length}</p>
                   </div>
                </div>
            </Card>
            <Card className="p-6 bg-white border-none shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En attente</p>
                      <p className="text-2xl font-black text-slate-900">{contacts.filter(c => c.status === "UNREAD").length}</p>
                   </div>
                </div>
            </Card>
        </div>

        {/* Search Bar */}
        <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input 
                type="text"
                placeholder="Rechercher par nom, email ou contenu du message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-16 pl-14 pr-6 bg-white border-none shadow-sm rounded-3xl text-sm font-medium focus:ring-2 focus:ring-blue-100 transition-all"
            />
        </div>

        {/* Messages List */}
        <div className="space-y-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chargement des messages...</p>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-dashed border-slate-200">
                    <MailQuestion className="w-16 h-16 text-slate-200 mb-4" />
                    <p className="text-lg font-black text-slate-900">Aucun message trouvé</p>
                    <p className="text-sm text-slate-400 font-medium">Les messages du site public apparaîtront ici.</p>
                </div>
            ) : (
                filteredContacts.map((contact) => (
                    <Card key={contact.id} className={`p-8 border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2.5rem] group ${
                        contact.status === "UNREAD" ? "bg-white ring-2 ring-blue-500/10" : "bg-white/70"
                    }`}>
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Left Side: Sender Info */}
                            <div className="w-full lg:w-72 shrink-0 space-y-4 border-r border-slate-100 pr-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-3xl bg-slate-900 text-white flex items-center justify-center font-black text-xl">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 truncate uppercase tracking-tight text-sm">{contact.name}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                            <div className={`w-1.5 h-1.5 rounded-full ${contact.status === 'UNREAD' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                                            {contact.status === "UNREAD" ? "Nouveau" : "Traité"}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 pt-4">
                                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium group/item hover:text-blue-600 transition-all cursor-pointer">
                                        <Mail className="w-4 h-4 text-slate-300 group-hover/item:text-blue-400" />
                                        <span className="truncate">{contact.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium group/item hover:text-emerald-600 transition-all cursor-pointer">
                                        <Phone className="w-4 h-4 text-slate-300 group-hover/item:text-emerald-400" />
                                        <span>{contact.phone || "Non spécifié"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium pt-2">
                                        <Clock className="w-4 h-4 text-slate-300" />
                                        <span>{format(new Date(contact.createdAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</span>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Badge className={`px-4 py-1.5 rounded-xl uppercase text-[9px] font-black tracking-widest border-none ${
                                        contact.subject === "rdv" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                    }`}>
                                        {contact.subject === "rdv" ? "Prendre RDV" : contact.subject === "mesure" ? "Sur-mesure" : "Information"}
                                    </Badge>
                                </div>
                            </div>

                            {/* Center: Message Content */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-slate-200" />
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Message</span>
                                </div>
                                <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-50">
                                    <p className="text-slate-700 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                                        {contact.message}
                                    </p>
                                </div>
                            </div>

                            {/* Right Side: Actions */}
                            <div className="w-full lg:w-48 shrink-0 flex lg:flex-col justify-end gap-3 lg:border-l lg:border-slate-100 lg:pl-8">
                                {contact.status === "UNREAD" ? (
                                    <Button 
                                        onClick={() => handleUpdateStatus(contact.id, "READ")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 gap-2 text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-100"
                                    >
                                        <CheckCheck className="w-4 h-4" /> Traité
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleUpdateStatus(contact.id, "UNREAD")}
                                        className="rounded-2xl h-12 border-slate-100 text-slate-400 gap-2 text-xs font-bold"
                                    >
                                        <RotateCcw className="w-4 h-4" /> Rétablir
                                    </Button>
                                )}
                                <Button 
                                    variant="outline"
                                    onClick={() => handleDelete(contact.id)}
                                    className="rounded-2xl h-12 border-slate-100 text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all text-xs font-bold"
                                >
                                    <Trash2 className="w-4 h-4" /> Supprimer
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))
            )}
        </div>
      </div>
    </div>
  );
}

function RotateCcw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
