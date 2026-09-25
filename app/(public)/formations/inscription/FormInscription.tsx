"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { div as MotionDiv } from "framer-motion/client";
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
  const formationIdParam = searchParams.get("formationId") || "";
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { formationId: formationIdParam },
    mode: "onBlur",
  });

  const selectedFormationId = watch("formationId");
  const selectedFormation = formations.find((f) => f.id === selectedFormationId);
  const errorEntries = Object.entries(errors).filter(([, error]) => Boolean(error?.message));

  useEffect(() => {
    if (validationAttempt > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [validationAttempt]);

  const onValidSubmit = (data: FormData) => {
    setValidationAttempt(0);
    setSubmitError(null);
    return onSubmit(data);
  };

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
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      setSubmitError(message);
      toast.error(message);
    }
  };

  const handleInvalid = () => setValidationAttempt((attempt) => attempt + 1);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <MotionDiv
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
        </MotionDiv>
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
        <MotionDiv
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
            <MotionDiv
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl bg-brand/10 border border-brand/20 flex items-center gap-3"
            >
              <GraduationCap className="w-5 h-5 text-brand shrink-0" />
              <div>
                <span className="text-xs font-black text-brand-dark uppercase tracking-widest">Formation sélectionnée</span>
                <p className="text-sm font-bold text-brand-dark">{selectedFormation.name}</p>
              </div>
            </MotionDiv>
          )}

          {submitError && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800"
            >
              {submitError} Veuillez corriger le problème indiqué puis réessayer.
            </div>
          )}

          {validationAttempt > 0 && errorEntries.length > 0 && (
            <div
              ref={errorSummaryRef}
              role="alert"
              aria-labelledby="error-summary-title"
              tabIndex={-1}
              className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              <h2 id="error-summary-title" className="text-sm font-black">
                Le formulaire contient {errorEntries.length} {errorEntries.length > 1 ? "erreurs" : "erreur"}
              </h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                {errorEntries.map(([field, error]) => (
                  <li key={field}>
                    <a href={`#${field}`} className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700">
                      {error?.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onValidSubmit, handleInvalid)}
            noValidate
            aria-busy={isSubmitting}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="nom" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nom complet</label>
                <Input
                  {...register("nom")}
                  id="nom"
                  placeholder="Votre nom et prénom"
                  aria-invalid={Boolean(errors.nom)}
                  aria-describedby={errors.nom ? "nom-error" : undefined}
                  className={`h-14 rounded-2xl bg-white text-base font-medium ${errors.nom ? "border-red-600" : "border-slate-300"}`}
                />
                {errors.nom && <p id="nom-error" className="text-sm font-semibold text-red-700">{errors.nom.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Email</label>
                <Input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className={`h-14 rounded-2xl bg-white text-base font-medium ${errors.email ? "border-red-600" : "border-slate-300"}`}
                />
                {errors.email && <p id="email-error" className="text-sm font-semibold text-red-700">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="telephone" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Téléphone</label>
                <Input
                  {...register("telephone")}
                  id="telephone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+229 XX XX XX XX"
                  aria-invalid={Boolean(errors.telephone)}
                  aria-describedby={errors.telephone ? "telephone-error" : undefined}
                  className={`h-14 rounded-2xl bg-white text-base font-medium ${errors.telephone ? "border-red-600" : "border-slate-300"}`}
                />
                {errors.telephone && <p id="telephone-error" className="text-sm font-semibold text-red-700">{errors.telephone.message}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="formationId" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Formation souhaitée</label>
                <Select
                  value={selectedFormationId}
                  onValueChange={(val) => {
                    setSubmitError(null);
                    setValue("formationId", val, { shouldValidate: true, shouldDirty: true });
                  }}
                >
                  <SelectTrigger
                    id="formationId"
                    aria-invalid={Boolean(errors.formationId)}
                    aria-describedby={errors.formationId ? "formationId-error" : undefined}
                    className={`h-14 rounded-2xl bg-white text-base font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${errors.formationId ? "border-red-600" : "border-slate-300"}`}
                  >
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
                {errors.formationId && <p id="formationId-error" className="text-sm font-semibold text-red-700">{errors.formationId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-xs font-bold text-slate-700 uppercase tracking-widest">Message (optionnel)</label>
              <Textarea
                {...register("message")}
                id="message"
                placeholder="Avez-vous des questions ou des besoins particuliers ?"
                className="min-h-[120px] rounded-2xl bg-white border-slate-300 text-base font-medium resize-y"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black text-sm uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-slate-200 disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  Envoi en cours…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Envoyer ma candidature <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </span>
              )}
            </Button>
          </form>
        </MotionDiv>
      </div>
    </div>
  );
}
