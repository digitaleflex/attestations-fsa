"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, XCircle, Sparkles } from "lucide-react";
// Confetti simple (SVG fallback)

const schema = z.object({
  code: z.string().min(8, "Code requis").max(64, "Code trop long")
});

type FormData = z.infer<typeof schema>;

export default function VerifierPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    setShowConfetti(false);
    try {
      const res = await fetch(`/api/verifier?code=${encodeURIComponent(data.code)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur serveur");
      }
      const { attestation } = await res.json();
      setResult(attestation);
      setTimeout(() => setShowConfetti(true), 200); // petit délai pour l'effet
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showConfetti) {
      const timeout = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [showConfetti]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-xl mx-auto bg-white/60 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-8 flex flex-col items-center animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-8 h-8 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Vérifier une Attestation</h1>
        </div>
        {/* Formulaire */}
        <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4 mb-6">
          <label htmlFor="code" className="text-sm font-medium text-gray-700">Code d’attestation</label>
          <input
            id="code"
            type="text"
            placeholder="FSA-2025-M07-00001-3f8b6"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg bg-white/80 backdrop-blur"
            {...register("code")}
            autoComplete="off"
            disabled={loading}
          />
          {errors.code && <span className="text-red-600 text-sm">{errors.code.message}</span>}
          <button
            type="submit"
            className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold text-lg shadow-lg hover:scale-105 hover:shadow-2xl focus:scale-105 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Vérification..." : "Vérifier"}
          </button>
        </form>
        {/* Résultat */}
        {result && (
          <div className="w-full animate-fade-in-up rounded-xl border border-green-200 bg-white/70 backdrop-blur-md p-6 mt-2 text-green-900 relative overflow-hidden">
            {/* Confetti SVG simple */}
            {showConfetti && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 400 120" fill="none">
                <circle cx="40" cy="30" r="6" fill="#16a34a" opacity="0.7" />
                <circle cx="120" cy="20" r="4" fill="#facc15" opacity="0.7" />
                <circle cx="200" cy="35" r="7" fill="#2563eb" opacity="0.7" />
                <circle cx="300" cy="25" r="5" fill="#f59e42" opacity="0.7" />
                <circle cx="360" cy="40" r="6" fill="#16a34a" opacity="0.7" />
                <circle cx="80" cy="60" r="5" fill="#f59e42" opacity="0.7" />
                <circle cx="250" cy="60" r="4" fill="#facc15" opacity="0.7" />
                <circle cx="340" cy="70" r="6" fill="#2563eb" opacity="0.7" />
              </svg>
            )}
            {/* Illustration de succès */}
            <div className="flex items-center gap-4 mb-4">
              <svg viewBox="0 0 60 60" width={60} height={60} aria-hidden className="drop-shadow-lg">
                <circle cx="30" cy="30" r="28" fill="#f0fdf4" stroke="#16a34a" strokeWidth="3" />
                <ShieldCheck x="15" y="15" width="30" height="30" color="#16a34a" />
                <Sparkles x="38" y="10" width="16" height="16" color="#facc15" />
              </svg>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-green-600 text-white text-sm font-bold animate-pulse">Attestation valide</span>
                <div className="text-lg font-bold text-green-800 mt-1">Félicitations !</div>
              </div>
            </div>
            <div className="mb-1"><span className="font-semibold">Nom :</span> {result.fullName}</div>
            <div className="mb-1"><span className="font-semibold">Formation :</span> {result.formation?.name || '-'}</div>
            <div className="mb-1"><span className="font-semibold">Type :</span> {result.type}</div>
            <div className="mb-1"><span className="font-semibold">Dates :</span> {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}</div>
            <div className="mb-1"><span className="font-semibold">Lieu :</span> {result.location}</div>
            <div className="mb-1"><span className="font-semibold">Formateur :</span> {result.instructor}</div>
            <div className="mb-1"><span className="font-semibold">Statut :</span> <span className="inline-block px-2 py-1 rounded bg-green-600 text-white text-xs ml-1">{result.status}</span></div>
            <div className="mt-4 text-green-700 text-sm italic">La Ferme St André s’engage pour la confiance et la transparence de vos parcours professionnels.</div>
          </div>
        )}
        {error && (
          <div className="w-full animate-fade-in rounded-xl border border-red-200 bg-red-50 p-6 mt-2 text-red-900 flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            <span className="font-bold">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
} 