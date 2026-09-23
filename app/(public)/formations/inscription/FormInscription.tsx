"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowRight, CheckCircle, GraduationCap,
  Loader2, Sparkles
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Formation {
  id: string;
  name: string;
  category: string;
  description: string | null;
  skills: string[];
}

const schema = z.object({
  nom: z.string().min(2, "Nom requis (min 2 caractères)"),
  email: z.string().email("Email invalide"),
  telephone: z.string().min(8, "Téléphone invalide").max(20),
  formationId: z.string().min(1, "Veuillez sélectionner une formation"),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function FormInscription({ formations }: { formations: Formation[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const formationIdParam = searchParams.get("formationId") || "";
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { formationId: formationIdParam },
  });

  const selectedFormationId = watch("formationId");
  const selectedFormation = formations.find((f) => f.id === selectedFormationId);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/formations/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de l'inscription");
      }
      setSubmitted(true);
      toast.success("Inscription envoyée avec succès !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full text-center space-y-6 p-12 rounded-[3rem] bg-white border border-slate-100 shadow-sm"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900">Inscription reçue !</h2>
          <p className="text-slate-500 font-medium">
            Nous vous recontacterons très prochainement pour confirmer votre participation.
          </p>
          <Button asChild className="rounded-2xl h-14 px-10">
            <Link href="/formations">
              Retour aux formations <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 selection:bg-brand selection:text-white w-full">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80vw] h-[80vw] bg-brand/[0.02] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[70vw] h-[70vw] bg-blue-500/[0.015] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-100 shadow-sm text-brand text-[10px] font-black uppercase tracking-[0.25em]">
              <Sparkles className="w-4 h-4" />
              Inscription
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Inscription aux{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-dark">
                Formations
              </span>
            </h1>
            <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto">
              Remplissez le formulaire ci-dessous pour vous inscrire à la formation de votre choix.
            </p>
          </div>

          {selectedFormation && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-brand/10 border border-brand/20 flex items-center gap-3"
            >
              <GraduationCap className="w-5 h-5 text-brand shrink-0" />
              <div>
                <span className="text-xs font-black text-brand-dark uppercase tracking-widest">Formation sélectionnée</span>
                <p className="text-sm font-bold text-brand-dark">{selectedFormation.name}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nom complet</label>
                <Input
                  {...register("nom")}
                  placeholder="Votre nom et prénom"
                  className="h-14 rounded-2xl bg-white border-slate-200 text-base font-medium"
                />
                {errors.nom && <p className="text-xs text-red-500 font-medium">{errors.nom.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Email</label>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="vous@exemple.com"
                  className="h-14 rounded-2xl bg-white border-slate-200 text-base font-medium"
                />
                {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Téléphone</label>
                <Input
                  {...register("telephone")}
                  placeholder="+229 XX XX XX XX"
                  className="h-14 rounded-2xl bg-white border-slate-200 text-base font-medium"
                />
                {errors.telephone && <p className="text-xs text-red-500 font-medium">{errors.telephone.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Formation souhaitée</label>
                <Select
                  value={selectedFormationId}
                  onValueChange={(val) => setValue("formationId", val, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-14 rounded-2xl bg-white border-slate-200 text-base font-medium">
                    <SelectValue placeholder="Sélectionnez une formation" />
                  </SelectTrigger>
                  <SelectContent>
                    {formations.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.formationId && <p className="text-xs text-red-500 font-medium">{errors.formationId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Message (optionnel)</label>
              <Textarea
                {...register("message")}
                placeholder="Avez-vous des questions ou des besoins particuliers ?"
                className="min-h-[120px] rounded-2xl bg-white border-slate-200 text-base font-medium resize-y"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Envoyer ma candidature <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
