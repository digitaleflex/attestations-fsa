"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Calendar, 
  MessageSquare, 
  User, 
  Building,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Link from "next/link";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "mesure",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: "", email: "", phone: "", subject: "mesure", message: "" });
        toast.success("Message envoyé avec succès !");
      } else {
        toast.error(data.error || "Une erreur est survenue");
      }
    } catch (error) {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] selection:bg-emerald-100 selection:text-emerald-900 pb-24 overflow-x-hidden pt-24 md:pt-36">
      {/* Decorative Blur Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-emerald-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-10 left-[-10%] w-[50vw] h-[50vw] bg-blue-100/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:items-start">
          
          {/* Left Column: Info & Content */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-10 md:space-y-12"
          >
            <div className="space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-slate-100 shadow-xl shadow-slate-200/50 text-emerald-600 self-start">
                    <Sparkles className="w-4 h-4 fill-emerald-500" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em]">Parlons de votre futur</span>
                </div>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.9] tracking-tight">
                    Prendre <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-blue-600">
                        RDV.
                    </span>
                </h1>
                <p className="text-slate-500 text-base md:text-xl font-medium leading-relaxed max-w-lg">
                    Besoin de conseils ou d'un programme sur-mesure ? Notre équipe est à votre écoute.
                </p>
            </div>

            <div className="space-y-6">
                <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">Nos coordonnées</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6">
                    <div className="flex items-center lg:items-start gap-4 md:gap-6 group">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-emerald-500 shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                             <Phone className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Téléphone</p>
                            <p className="text-base md:text-lg font-bold text-slate-800 tracking-tight">+229 01 91 07 60 93</p>
                        </div>
                    </div>

                    <div className="flex items-center lg:items-start gap-4 md:gap-6 group">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-blue-500 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                             <Mail className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Email Officiel</p>
                            <p className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">contact@fermestandre.com</p>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-start gap-6 group">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                             <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Localisation</p>
                            <p className="text-lg font-bold text-slate-800 tracking-tight">Abomey-Calavi, Bénin</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] bg-slate-900 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Calendar className="w-20 h-20 md:w-24 md:h-24" />
                 </div>
                 <h4 className="text-xl md:text-2xl font-black mb-1 md:mb-2">Visite Gratuite</h4>
                 <p className="text-slate-400 text-xs md:text-sm font-medium mb-6 max-w-[200px] md:max-w-none">Découvrez nos installations avec nos ingénieurs.</p>
                 <Link href="/">
                    <Button variant="outline" className="h-10 md:h-12 rounded-xl border-white/20 hover:bg-white hover:text-slate-900 transition-all font-bold text-xs">
                        En savoir plus
                    </Button>
                 </Link>
            </div>
          </motion.div>

          {/* Right Column: The Form */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative lg:mt-0"
          >
             <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 blur-3xl opacity-50 rounded-[4rem]" />
             
             <div className="relative bg-white/70 backdrop-blur-3xl border border-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.05)]">
                {submitted ? (
                   <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-16 md:py-20 text-center space-y-6"
                   >
                     <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-100 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto text-emerald-600 mb-6 md:mb-8">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12" />
                     </div>
                     <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">C'est envoyé !</h3>
                     <p className="text-slate-500 text-sm md:text-base font-medium max-w-[240px] mx-auto leading-relaxed">
                        Merci ! Un conseiller vous contactera sous 24h.
                     </p>
                     <Button 
                        onClick={() => setSubmitted(false)}
                        variant="link"
                        className="text-emerald-600 font-black uppercase text-[10px] tracking-widest"
                     >
                        Envoyer un autre message
                     </Button>
                   </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-2">Nom Complet</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input 
                                    name="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                    placeholder="Koffi Sènou" 
                                    className="h-12 md:h-14 pl-11 pr-4 bg-white/60 border-slate-100/50 rounded-xl md:rounded-2xl focus:ring-emerald-500/20 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input 
                                    name="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    required
                                    type="email"
                                    placeholder="koffi@email.com" 
                                    className="h-12 md:h-14 pl-11 pr-4 bg-white/60 border-slate-100/50 rounded-xl md:rounded-2xl focus:ring-emerald-500/20 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-2">Téléphone</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <Input 
                                    name="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    required
                                    placeholder="+229 01..." 
                                    className="h-12 md:h-14 pl-11 pr-4 bg-white/60 border-slate-100/50 rounded-xl md:rounded-2xl focus:ring-emerald-500/20 focus:bg-white transition-all font-bold text-slate-800 text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-2">Objet</label>
                            <div className="relative">
                                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                                <select 
                                    name="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                    required
                                    className="w-full h-12 md:h-14 pl-11 pr-10 bg-white/60 border-slate-100/50 rounded-xl md:rounded-2xl focus:ring-emerald-500/20 focus:bg-white transition-all font-bold text-slate-800 appearance-none text-xs md:text-sm"
                                >
                                    <option value="mesure">Programme sur-mesure</option>
                                    <option value="info">Informations générales</option>
                                    <option value="rdv">Prendre rendez-vous</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-2">Message</label>
                        <Textarea 
                            name="message"
                            value={formData.message}
                            onChange={(e) => setFormData({...formData, message: e.target.value})}
                            required
                            placeholder="Décrivez votre projet..."
                            className="min-h-[120px] md:min-h-[150px] p-5 md:p-6 bg-white/60 border-slate-100/50 rounded-2xl md:rounded-[2rem] focus:ring-emerald-500/20 focus:bg-white transition-all font-bold text-slate-800 resize-none text-sm"
                        />
                    </div>

                    <Button 
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-900 hover:bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-sm shadow-2xl shadow-emerald-500/10 transition-all duration-500 group/btn active:scale-[0.98]"
                    >
                        {loading ? "Envoi..." : "Envoyer ma demande"}
                        <Send className="w-4 h-4 md:w-5 md:h-5 ml-4 transition-transform group-hover/btn:translate-x-2 group-hover/btn:-translate-y-2 shrink-0" />
                    </Button>
                  </form>
                )}
             </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
