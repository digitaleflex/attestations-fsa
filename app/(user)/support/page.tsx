"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Phone,
  Mail,
  HelpCircle,
  Clock,
  Send,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECH");
  const [urgency, setUrgency] = useState("MEDIUM");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const categories = [
    { id: "TECH", label: "Problème Technique", icon: "🛠️" },
    { id: "EXAM", label: "Session d'Examen", icon: "📝" },
    { id: "DOCS", label: "Attestation & Documents", icon: "🎓" },
    { id: "PLAN", label: "Emploi du temps", icon: "📅" },
    { id: "OTHER", label: "Autre demande", icon: "💡" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return toast.error("Veuillez remplir tous les champs");

    setIsSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `[${category}] ${subject} (${urgency})`,
          message,
          metadata: { category, urgency }
        }),
      });

      if (!res.ok) throw new Error("Erreur serveur");

      const data = await res.json();
      toast.success(data.message || "Message envoyé avec succès !");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error("Une erreur est survenue lors de l'envoi.");
    } finally {
      setIsSending(false);
    }
  };

  const contactMethods = [
    {
      icon: MessageCircle,
      title: "Chat WhatsApp",
      description: "Prévu prochainement pour les urgences d'examen.",
      action: "Bientôt disponible",
      link: "#",
      color: "bg-emerald-50 text-emerald-600 border-emerald-100",
      comingSoon: true
    },
    {
      icon: Phone,
      title: "Assistance Téléphonique",
      description: "Notre centre d'appel est en cours de configuration.",
      action: "Bientôt disponible",
      link: "#",
      color: "bg-blue-50 text-blue-600 border-blue-100",
      comingSoon: true
    },
    {
      icon: Mail,
      title: "Support Email Officiel",
      description: "Utilisez cet email pour toute demande urgente.",
      action: "contact@eurinhash.com",
      link: "mailto:contact@eurinhash.com",
      color: "bg-purple-50 text-purple-600 border-purple-100"
    }
  ];

  const commonQuestions = [
    "Comment corriger mon nom sur l'attestation ?",
    "Mon examen ne s'affiche pas dans la liste.",
    "J'ai un problème de connexion pendant l'épreuve.",
    "Quand recevrai-je mes résultats définitifs ?"
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Centre de Support</h1>
          <p className="text-slate-500 font-medium">Une assistance dédiée pour vous accompagner dans votre réussite.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            Support Actif (24/7)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne de gauche: Formulaire */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-8 border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                <MessageSquare size={120} />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Envoyer un ticket d'assistance
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {categories.slice(0, 4).map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategory(cat.id)}
                                className={`flex items-center gap-2 p-3 rounded-xl border text-[11px] font-bold transition-all ${
                                    category === cat.id
                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100"
                                    : "bg-white border-slate-100 text-slate-600 hover:border-blue-200"
                                }`}
                            >
                                <span>{cat.icon}</span>
                                <span className="truncate">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Niveau d'urgence</Label>
                    <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                        {[
                            { id: "LOW", label: "Basse", color: "text-slate-500", active: "bg-white text-slate-900" },
                            { id: "MEDIUM", label: "Moyenne", color: "text-amber-500", active: "bg-amber-500 text-white" },
                            { id: "HIGH", label: "Haute", color: "text-rose-500", active: "bg-rose-500 text-white" },
                        ].map(level => (
                            <button
                                key={level.id}
                                type="button"
                                onClick={() => setUrgency(level.id)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                                    urgency === level.id ? level.active + " shadow-sm" : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                {level.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 italic px-1">
                        {urgency === "HIGH" ? "⚠️ Réservé aux problèmes bloquants pendant l'examen." : "Traitement standard sous 24h."}
                    </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Objet bref de votre demande</Label>
                <div className="relative">
                    <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Ex: Erreur d'orthographe sur mon certificat"
                        className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-xl pl-4 text-sm font-medium"
                    />
                    {subject.length > 5 && commonQuestions.some(q => q.toLowerCase().includes(subject.toLowerCase())) && (
                        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl z-20 animate-in fade-in slide-in-from-top-2">
                            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Suggestion intelligente :</p>
                            <p className="text-xs text-blue-800">C'est une question fréquente ! <span className="underline font-bold cursor-pointer">Consultez notre guide dédié ici.</span></p>
                        </div>
                    )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="message" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Message détaillé</Label>
                    <span className={`text-[10px] font-bold ${message.length > 50 ? 'text-emerald-500' : 'text-slate-300'}`}>
                        {message.length} caractères
                    </span>
                </div>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Aidez-nous à vous aider en étant le plus précis possible..."
                  className="min-h-[160px] border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-2xl p-4 text-sm resize-none"
                />
              </div>

              <div className="pt-2">
                <Button
                    type="submit"
                    disabled={isSending || message.length < 10}
                    className="w-full h-14 bg-slate-900 hover:bg-black text-white font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-[0.98] group flex items-center justify-center gap-3"
                >
                    {isSending ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Traitement sécurisé...
                    </div>
                    ) : (
                    <>
                        <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        Soumettre mon ticket d'assistance
                    </>
                    )}
                </Button>
                <p className="text-center text-[10px] text-slate-400 mt-4 font-medium italic">
                    En soumettant ce formulaire, vous acceptez d'être recontacté(e) par notre équipe.
                </p>
              </div>
            </form>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6 bg-slate-900 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                    <ShieldCheck size={100} />
                </div>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Sécurité renforcée
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">
                    Toutes vos communications avec nos assistants sont privées et sécurisées.
                </p>
            </Card>
            <Card className="p-6 bg-blue-600 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                    <Clock size={100} />
                </div>
                <h4 className="font-bold mb-2 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-200" />
                    Temps de réponse
                </h4>
                <p className="text-sm text-blue-100 leading-relaxed">
                    Nos assistants traitent vos demandes en priorité sous un délai de 24h ouvrées.
                </p>
            </Card>
          </div>
        </div>

        {/* Colonne de droite: Contacts Rapides */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-2">
            <HelpCircle className="w-5 h-5 text-emerald-500" />
            Contacts Rapides
          </h3>

          <div className="space-y-4">
            {contactMethods.map((method, idx) => (
              <Card key={idx} className={`p-5 border-slate-100 transition-all group ${method.comingSoon ? "grayscale-[0.5] opacity-80" : "hover:shadow-xl hover:-translate-y-1"}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${method.color} shadow-sm transition-transform ${!method.comingSoon ? "group-hover:scale-110" : "opacity-60"}`}>
                    <method.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{method.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{method.description}</p>
                    <a
                        href={method.link}
                        className={`inline-flex items-center gap-1.5 mt-3 text-xs font-bold transition-transform ${
                            method.comingSoon ? "text-slate-400 cursor-not-allowed" : "text-slate-900 hover:translate-x-1"
                        }`}
                        onClick={method.comingSoon ? (e) => e.preventDefault() : undefined}
                    >
                      {method.action}
                      {!method.comingSoon && <ExternalLink className="w-3 h-3" />}
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-6 bg-slate-50 border-slate-100">
             <h4 className="font-bold text-slate-800 mb-4 text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                Questions Fréquentes
             </h4>
             <ul className="space-y-3">
                {commonQuestions.map((q, i) => (
                  <li key={i} className="text-xs text-slate-600 hover:text-blue-600 cursor-pointer flex items-center gap-2 group">
                    <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
                    {q}
                  </li>
                ))}
             </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
