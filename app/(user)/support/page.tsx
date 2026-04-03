"use client";

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
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return toast.error("Veuillez remplir tous les champs");
    
    setIsSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
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
      description: "Réponse instantanée pour les urgences d'examen.",
      action: "Ouvrir WhatsApp",
      link: "https://wa.me/22900000000",
      color: "bg-emerald-50 text-emerald-600 border-emerald-100"
    },
    {
      icon: Phone,
      title: "Assistance Téléphonique",
      description: "Disponible du lundi au vendredi, 8h - 18h.",
      action: "Appeler le +229 XX XX XX XX",
      link: "tel:+22900000000",
      color: "bg-blue-50 text-blue-600 border-blue-100"
    },
    {
      icon: Mail,
      title: "Support Email",
      description: "Pour les demandes administratives et corrections.",
      action: "Envoyer un email",
      link: "mailto:support@fsa.bj",
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
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-bold text-slate-700 ml-1">Sujet de votre demande</Label>
                <Input 
                  id="subject" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Problème d'affichage de mon nom" 
                  className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-bold text-slate-700 ml-1">Message détaillé</Label>
                <Textarea 
                  id="message" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Expliquez-nous votre souci le plus précisément possible..." 
                  className="min-h-[180px] border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all rounded-xl"
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSending}
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
              >
                {isSending ? (
                  "Envoi en cours..."
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-3" />
                    Soumettre ma demande
                  </>
                )}
              </Button>
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
              <Card key={idx} className="p-5 border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-2xl ${method.color} shadow-sm transition-transform group-hover:scale-110`}>
                    <method.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{method.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{method.description}</p>
                    <a 
                        href={method.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-slate-900 hover:translate-x-1 transition-transform"
                    >
                      {method.action}
                      <ExternalLink className="w-3 h-3" />
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
