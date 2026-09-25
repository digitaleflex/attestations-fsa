"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Briefcase,
  Send,
  Loader2,
  CheckCircle2,
  MapPin,
  GraduationCap,
  Mail,
  Phone,
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function InternshipApplicationPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    university: "",
    level: "",
    position: "",
    cvFile: null as File | null,
    message: ""
  });

  const validateStep1 = () => {
    if (!formData.fullName.trim()) {
      toast.error("Veuillez entrer votre nom complet");
      return false;
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Veuillez entrer une adresse e-mail valide");
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error("Veuillez entrer votre numéro de téléphone");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.position) {
      toast.error("Veuillez sélectionner le poste souhaité");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        if (file.size > 3 * 1024 * 1024) {
          toast.error("Le fichier est trop lourd (max 3 Mo)");
          return;
        }
        setFormData({ ...formData, cvFile: file });
        toast.success(`CV importé : ${file.name}`);
      } else {
        toast.error("Seuls les fichiers PDF sont acceptés");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cvFile) {
      toast.error("Veuillez déposer votre CV");
      return;
    }
    if (!formData.message.trim()) {
      toast.error("Veuillez écrire vos motivations");
      return;
    }
    setLoading(true);

    try {
      // Le CV et les données sont envoyés dans la même requête publique.
      // L'API les valide avant stockage : aucun endpoint d'upload privé n'est
      // exposé au visiteur anonyme.
      const applicationForm = new FormData();
      applicationForm.append("fullName", formData.fullName);
      applicationForm.append("email", formData.email);
      applicationForm.append("phone", formData.phone);
      applicationForm.append("position", formData.position);
      applicationForm.append("university", formData.university);
      applicationForm.append("level", formData.level);
      applicationForm.append("message", formData.message);
      applicationForm.append("file", formData.cvFile);

      const res = await fetch("/api/public/internships", {
        method: "POST",
        body: applicationForm,
      });

      if (!res.ok) throw new Error("Erreur");

      toast.success("Votre demande a été envoyée !");
      setSubmitted(true);
    } catch {
      toast.error("Échec lors de l'envoi. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 px-6 animate-in fade-in zoom-in duration-700">
        <Card className="p-12 text-center space-y-8 border-none shadow-2xl bg-white rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
             <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Demande reçue !</h1>
            <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
              Merci pour l'intérêt que vous portez à la <strong>Ferme Agro-Piscicole Cité St André</strong>. Notre équipe examinera votre profil et vous recontactera très prochainement.
            </p>
          </div>
          <div className="pt-8">
            <Link href="/">
              <Button size="lg" className="h-14 px-12 bg-slate-900 hover:bg-slate-800 font-bold text-lg rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
                Retour à l'accueil
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-16 items-start animate-in slide-in-from-bottom-8 duration-700">
      
      {/* Colonne d'informations */}
      <div className="md:w-1/3 space-y-12">
        <div className="space-y-4">
          <div className="w-16 h-1 bg-brand rounded-full" />
          <h1 className="text-5xl font-black text-slate-900 leading-none">Postulez pour un Stage</h1>
          <p className="text-xl text-slate-500 leading-relaxed italic">Rejoignez une équipe dynamique et passionnée à la Ferme Agro-Piscicole Cité St André.</p>
        </div>

        <div className="space-y-8">
          <div className="flex gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
             <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-brand-dark group-hover:text-white transition-colors duration-500">
                <MapPin className="w-6 h-6" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800">Lieu du stage</h3>
                <p className="text-sm text-slate-500">Ferme Agro-Piscicole Cité St André, Abomey-Calavi, Bénin.</p>
             </div>
          </div>
          <div className="flex gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
             <div className="w-12 h-12 group-hover:bg-brand-dark text-brand-dark rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-brand-dark group-hover:text-white transition-colors duration-500">
                <GraduationCap className="w-6 h-6" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800">Niveau requis</h3>
                <p className="text-sm text-slate-500">Stagiaires de Licence, Master ou formation technique.</p>
             </div>
          </div>
        </div>
      </div>

      {/* Colonne du formulaire (Multi-étapes) */}
      <div className="md:w-2/3 w-full">
        <Card className="p-10 border-none shadow-3xl bg-white rounded-[2.5rem] relative overflow-hidden">
          
          {/* VRAI Indicateur de progression par étapes */}
          <div className="absolute top-10 right-10 flex gap-2">
             <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'w-8 bg-brand' : 'w-4 bg-slate-100'}`} />
             <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'w-8 bg-brand' : 'w-4 bg-slate-100'}`} />
             <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 3 ? 'w-8 bg-brand' : 'w-4 bg-slate-100'}`} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 mt-6">
            <AnimatePresence mode="wait">
              
              {/* ÉTAPE 1 : IDENTITÉ & CONTACT */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-brand">Étape 1 sur 3</span>
                    <h2 className="text-2xl font-black text-slate-800">Vos informations personnelles</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="fullName" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Nom complet</Label>
                      <div className="relative">
                        <Input
                          id="fullName"
                          placeholder="Sènou Dossou"
                          value={formData.fullName}
                          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                          required
                          className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner"
                        />
                        <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><FileText className="w-5 h-5" /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="email" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Email</Label>
                        <div className="relative">
                          <Input
                            id="email"
                            type="email"
                            placeholder="senou.dossou@gmail.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            required
                            className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner"
                          />
                          <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><Mail className="w-5 h-5" /></div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="phone" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Téléphone</Label>
                        <div className="relative">
                          <Input
                            id="phone"
                            placeholder="+229 ..."
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            required
                            className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner"
                          />
                          <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-300"><Phone className="w-5 h-5" /></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="h-14 px-8 bg-slate-900 hover:bg-slate-800 rounded-2xl font-bold text-sm gap-2 transition-all active:scale-95 flex items-center"
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ÉTAPE 2 : PROFIL & ÉTUDES */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-brand">Étape 2 sur 3</span>
                    <h2 className="text-2xl font-black text-slate-800">Votre profil académique</h2>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="position" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Poste souhaité</Label>
                      <div className="relative">
                        <select
                          id="position"
                          value={formData.position}
                          onChange={(e) => setFormData({...formData, position: e.target.value})}
                          required
                          className="w-full h-14 px-6 bg-slate-50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner outline-none appearance-none"
                        >
                          <option value="">Sélectionnez le domaine...</option>
                          <option value="Pisciculture">Pisciculture / Aquaculture</option>
                          <option value="Agriculture">Agriculture / Agronomie</option>
                          <option value="Elevage">Élevage / Aviculture</option>
                          <option value="Autre">Autre (Admin, Gestion, Tech)</option>
                        </select>
                        <div className="absolute top-1/2 right-6 -translate-y-1/2 text-slate-400 pointer-events-none"><Briefcase className="w-5 h-5" /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="university" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Université / Établissement</Label>
                        <Input
                          id="university"
                          placeholder="Ex: UAC"
                          value={formData.university}
                          onChange={(e) => setFormData({...formData, university: e.target.value})}
                          className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="level" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Niveau d'études</Label>
                        <Input
                          id="level"
                          placeholder="Ex: Licence 3"
                          value={formData.level}
                          onChange={(e) => setFormData({...formData, level: e.target.value})}
                          className="h-14 px-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      onClick={handleBack}
                      className="h-14 px-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-sm gap-2 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Retour
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="h-14 px-8 bg-slate-900 hover:bg-slate-800 rounded-2xl font-bold text-sm gap-2 transition-all flex items-center"
                    >
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ÉTAPE 3 : DOCUMENTS & MOTIVATIONS */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-brand">Étape 3 sur 3</span>
                    <h2 className="text-2xl font-black text-slate-800">Votre candidature (CV & Motivations)</h2>
                  </div>

                  <div className="space-y-6">
                    {/* Zone de Drag & Drop pour le CV */}
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Curriculum Vitae (PDF)</Label>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`w-full border-2 border-dashed rounded-[2rem] p-8 text-center flex flex-col items-center justify-center gap-4 transition-all relative ${
                          dragActive ? "border-brand bg-brand/10" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {formData.cvFile ? (
                          <div className="space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto shadow-sm">
                              <FileText className="w-7 h-7" />
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-800 text-sm max-w-xs truncate mx-auto">{formData.cvFile.name}</p>
                              <p className="text-xs text-slate-400 mt-1">{(formData.cvFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setFormData({ ...formData, cvFile: null })}
                              className="text-xs font-bold text-rose-500 hover:text-rose-600 underline"
                            >
                              Supprimer le fichier
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                              <UploadCloud className="w-7 h-7" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-700 text-sm">Glissez-déposez votre CV ici</p>
                              <p className="text-xs text-slate-400">ou cliquez pour parcourir vos dossiers (PDF, Max 3 Mo)</p>
                            </div>
                            <input 
                              type="file"
                              id="cvFile"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (file) {
                                  if (file.type === "application/pdf") {
                                    if (file.size > 3 * 1024 * 1024) {
                                      toast.error("Le fichier est trop lourd (max 3 Mo)");
                                      return;
                                    }
                                    setFormData({ ...formData, cvFile: file });
                                    toast.success(`CV importé : ${file.name}`);
                                  } else {
                                    toast.error("Seuls les fichiers PDF sont acceptés");
                                  }
                                }
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="message" className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1">Quelques lignes sur votre motivation</Label>
                      <Textarea
                        id="message"
                        placeholder="Décrivez brièvement votre projet professionnel et ce que vous souhaitez accomplir à la ferme..."
                        value={formData.message}
                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                        required
                        className="min-h-[120px] p-6 bg-slate-50 border-none rounded-3xl focus:ring-2 focus:ring-brand/20 text-base font-medium shadow-inner outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      onClick={handleBack}
                      className="h-14 px-6 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-2xl font-bold text-sm gap-2 transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-14 px-8 bg-brand hover:bg-brand-dark text-white rounded-2xl font-black text-sm gap-2 shadow-lg shadow-brand/20 transition-all hover:scale-105 active:scale-95 group flex items-center"
                    >
                      {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                        <>
                          <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          Soumettre ma candidature
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </form>
        </Card>
      </div>
    </div>
  );
}
