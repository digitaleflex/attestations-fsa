"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send, 
  Calendar, 
  MessageSquare, 
  User, 
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Link from "next/link";

type ContactField = "name" | "email" | "phone" | "subject" | "message";
type ContactFieldErrors = Partial<Record<ContactField, string>>;

function ContactContent() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "mesure",
    message: "",
  });

  const searchParams = useSearchParams();

  useEffect(() => {
    const sub = searchParams?.get("subject");
    const formationId = searchParams?.get("formationId");
    if (sub === "inscription") {
      setFormData(prev => ({
        ...prev,
        subject: "inscription",
        message: formationId 
          ? `Bonjour, je souhaite m'inscrire à la formation (ID: ${formationId}). Pouvez-vous me recontacter ?` 
          : "Bonjour, je souhaite obtenir des informations pour m'inscrire à l'une de vos formations."
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (submitError) {
      errorSummaryRef.current?.focus();
    }
  }, [submitError]);

  const clearFieldError = (field: ContactField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateField = (field: ContactField, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setSubmitted(true);
        setFormData({ name: "", email: "", phone: "", subject: "mesure", message: "" });
        toast.success("Message envoyé avec succès !");
        return;
      }

      const nextFieldErrors: ContactFieldErrors = {};
      if (Array.isArray(data.details)) {
        for (const detail of data.details) {
          const field = detail?.path?.[0];
          if (typeof detail?.message === "string" && ["name", "email", "phone", "subject", "message"].includes(field)) {
            nextFieldErrors[field as ContactField] = detail.message;
          }
        }
      }
      setFieldErrors(nextFieldErrors);
      setSubmitError(typeof data.error === "string" ? data.error : "Une erreur est survenue. Veuillez vérifier votre formulaire et réessayer.");
    } catch {
      setSubmitError("Erreur de connexion au serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] selection:bg-brand selection:text-white pb-24 overflow-x-hidden pt-24 md:pt-36">
      {/* Decorative Blur Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-brand/10 rounded-full blur-[120px]" />
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
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white border border-slate-100 shadow-xl shadow-slate-200/50 text-brand self-start">
                    <Sparkles className="w-4 h-4 fill-brand" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em]">Parlons de votre futur</span>
                </div>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 leading-[0.9] tracking-tight">
                    Prendre <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand to-brand-dark">
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
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-brand shrink-0 group-hover:bg-brand group-hover:text-white transition-all duration-300">
                             <Phone className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Téléphone</p>
                            <a href="tel:+2290191076093" className="text-base md:text-lg font-bold text-slate-800 tracking-tight hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 rounded-sm">+229 01 91 07 60 93</a>
                        </div>
                    </div>

                    <div className="flex items-center lg:items-start gap-4 md:gap-6 group">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-blue-500 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                             <Mail className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Email officiel</p>
                            <a href="mailto:contact@fermestandre.com" className="block truncate text-base md:text-lg font-bold text-slate-800 tracking-tight hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 rounded-sm">contact@fermestandre.com</a>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-start gap-6 group">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-lg flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                             <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Localisation</p>
                            <a href="https://www.google.com/maps/search/?api=1&query=Abomey-Calavi%2C%20B%C3%A9nin" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-lg font-bold text-slate-800 tracking-tight hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-4 rounded-sm">Abomey-Calavi, Bénin <span aria-hidden="true" className="text-xs">↗</span></a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] bg-slate-900 text-white relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Calendar className="w-20 h-20 md:w-24 md:h-24" />
                 </div>
                 <h4 className="text-xl md:text-2xl font-black mb-1 md:mb-2">Besoin d’un rendez-vous ?</h4>
                 <p className="text-slate-400 text-xs md:text-sm font-medium mb-6 max-w-[240px] md:max-w-none">Décrivez votre besoin dans le formulaire. Notre équipe vous répondra sous 24 heures.</p>
                 <a href="#contact-form">
                    <Button variant="outline" className="h-10 md:h-12 rounded-xl border-white/20 hover:bg-white hover:text-slate-900 transition-all font-bold text-xs">
                        Écrire ma demande
                    </Button>
                 </a>
            </div>
          </motion.div>

          {/* Right Column: The Form */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative lg:mt-0"
          >
             <div className="absolute -inset-4 bg-gradient-to-r from-brand/10 to-brand-accent/10 blur-3xl opacity-50 rounded-[4rem]" />
             
             <div className="relative bg-white/70 backdrop-blur-3xl border border-white p-6 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.05)]">
                {submitted ? (
                   <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-16 md:py-20 text-center space-y-6"
                   >
                     <div className="w-20 h-20 md:w-24 md:h-24 bg-brand/10 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto text-brand mb-6 md:mb-8">
                        <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12" />
                     </div>
                     <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">C'est envoyé !</h3>
                     <p className="text-slate-500 text-sm md:text-base font-medium max-w-[240px] mx-auto leading-relaxed">
                        Merci ! Un conseiller vous contactera sous 24h.
                     </p>
                     <Button 
                        onClick={() => setSubmitted(false)}
                        variant="link"
                        className="text-brand font-black uppercase text-[10px] tracking-widest"
                     >
                        Envoyer un autre message
                     </Button>
                   </motion.div>
                ) : (
                   <form
                     id="contact-form"
                     onSubmit={handleSubmit}
                    aria-busy={loading}
                     className="space-y-6 md:space-y-8 scroll-mt-28"
                  >
                    {submitError && (
                      <div
                        ref={errorSummaryRef}
                        role="alert"
                        aria-live="assertive"
                        tabIndex={-1}
                        className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                      >
                        <p>Impossible d’envoyer votre message : {submitError}</p>
                        {Object.values(fieldErrors).length > 0 && (
                          <p className="mt-1 text-red-800">Consultez les erreurs indiquées ci-dessous.</p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-1.5">
                            <label htmlFor="contact-name" className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 tracking-[0.16em] ml-2">Nom Complet</label>
                            <div className="relative">
                                <User aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="contact-name"
                                    name="name"
                                    value={formData.name}
                                    onChange={(e) => updateField("name", e.target.value)}
                                    required
                                    placeholder="Koffi Sènou"
                                    aria-invalid={Boolean(fieldErrors.name)}
                                    aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                                    className={`h-12 md:h-14 pl-11 pr-4 bg-white border-slate-400 rounded-xl md:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:bg-white transition-all font-bold text-slate-900 text-sm ${fieldErrors.name ? "border-red-600" : ""}`}
                                />
                            </div>
                            {fieldErrors.name && <p id="contact-name-error" role="alert" className="ml-2 text-sm font-semibold text-red-800">{fieldErrors.name}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="contact-email" className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 tracking-[0.16em] ml-2">Email</label>
                            <div className="relative">
                                <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="contact-email"
                                    name="email"
                                    value={formData.email}
                                    onChange={(e) => updateField("email", e.target.value)}
                                    required
                                    type="email"
                                    placeholder="koffi@email.com"
                                    aria-invalid={Boolean(fieldErrors.email)}
                                    aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                                    className={`h-12 md:h-14 pl-11 pr-4 bg-white border-slate-400 rounded-xl md:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:bg-white transition-all font-bold text-slate-900 text-sm ${fieldErrors.email ? "border-red-600" : ""}`}
                                />
                            </div>
                            {fieldErrors.email && <p id="contact-email-error" role="alert" className="ml-2 text-sm font-semibold text-red-800">{fieldErrors.email}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        <div className="space-y-1.5">
                            <label htmlFor="contact-phone" className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 tracking-[0.16em] ml-2">Téléphone</label>
                            <div className="relative">
                                <Phone aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <Input
                                    id="contact-phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={(e) => updateField("phone", e.target.value)}
                                    required
                                    placeholder="+229 01..."
                                    aria-invalid={Boolean(fieldErrors.phone)}
                                    aria-describedby={fieldErrors.phone ? "contact-phone-error" : undefined}
                                    className={`h-12 md:h-14 pl-11 pr-4 bg-white border-slate-400 rounded-xl md:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:bg-white transition-all font-bold text-slate-900 text-sm ${fieldErrors.phone ? "border-red-600" : ""}`}
                                />
                            </div>
                            {fieldErrors.phone && <p id="contact-phone-error" role="alert" className="ml-2 text-sm font-semibold text-red-800">{fieldErrors.phone}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="contact-subject" className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 tracking-[0.16em] ml-2">Objet</label>
                            <div className="relative">
                                <MessageSquare aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <select
                                    id="contact-subject"
                                    name="subject"
                                    value={formData.subject}
                                    onChange={(e) => updateField("subject", e.target.value)}
                                    required
                                    aria-invalid={Boolean(fieldErrors.subject)}
                                    aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
                                    className={`w-full h-12 md:h-14 pl-11 pr-10 bg-white border-slate-400 rounded-xl md:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:bg-white transition-all font-bold text-slate-900 appearance-none text-xs md:text-sm ${fieldErrors.subject ? "border-red-600" : ""}`}
                                >
                                    <option value="mesure">Programme sur-mesure</option>
                                    <option value="inscription">Demande d'inscription</option>
                                    <option value="info">Informations générales</option>
                                    <option value="rdv">Prendre rendez-vous</option>
                                </select>
                                <div aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            </div>
                            {fieldErrors.subject && <p id="contact-subject-error" role="alert" className="ml-2 text-sm font-semibold text-red-800">{fieldErrors.subject}</p>}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label htmlFor="contact-message" className="text-[10px] md:text-[11px] font-black uppercase text-slate-700 tracking-[0.16em] ml-2">Message</label>
                        <Textarea
                            id="contact-message"
                            name="message"
                            value={formData.message}
                            onChange={(e) => updateField("message", e.target.value)}
                            required
                            placeholder="Décrivez votre projet..."
                            aria-invalid={Boolean(fieldErrors.message)}
                            aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
                            className={`min-h-[120px] md:min-h-[150px] p-5 md:p-6 bg-white border-slate-400 rounded-2xl md:rounded-[2rem] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus:bg-white transition-all font-bold text-slate-900 resize-none text-sm ${fieldErrors.message ? "border-red-600" : ""}`}
                        />
                        {fieldErrors.message && <p id="contact-message-error" role="alert" className="ml-2 text-sm font-semibold text-red-800">{fieldErrors.message}</p>}
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 md:h-20 rounded-2xl md:rounded-[2rem] bg-slate-900 hover:bg-brand-dark text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-sm shadow-2xl shadow-brand/20 transition-all duration-500 group/btn active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-70"
                    >
                        <span aria-live="polite">{loading ? "Envoi en cours…" : "Envoyer ma demande"}</span>
                        <Send aria-hidden="true" className={`w-4 h-4 md:w-5 md:h-5 ml-4 transition-transform shrink-0 ${loading ? "animate-pulse" : "group-hover/btn:translate-x-2 group-hover/btn:-translate-y-2"}`} />
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

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#fafbfc]">Chargement...</div>}>
      <ContactContent />
    </Suspense>
  );
}
