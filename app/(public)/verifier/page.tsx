"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck, XCircle } from "lucide-react";

const schema = z.object({
  code: z.string().min(8, "Code requis").max(64, "Code trop long")
});

type FormData = z.infer<typeof schema>;

export default function VerifierPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/verifier?code=${encodeURIComponent(data.code)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur serveur");
      }
      const { attestation } = await res.json();
      setResult(attestation);
    } catch (e: any) {
      setError(e.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg"
            {...register("code")}
            autoComplete="off"
            disabled={loading}
          />
          {errors.code && <span className="text-red-600 text-sm">{errors.code.message}</span>}
          <button
            type="submit"
            className="w-full py-3 mt-2 rounded-lg bg-black text-white font-semibold text-lg hover:bg-gray-900 transition disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Vérification..." : "Vérifier"}
          </button>
        </form>
        {/* Résultat */}
        {result && (
          <div className="w-full animate-fade-in rounded-xl border border-green-200 bg-green-50 p-6 mt-2 text-green-900">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-6 h-6 text-green-600" />
              <span className="font-bold text-lg">Attestation valide</span>
            </div>
            <div className="mb-1"><span className="font-semibold">Nom :</span> {result.fullName}</div>
            <div className="mb-1"><span className="font-semibold">Formation :</span> {result.formation?.name || '-'}</div>
            <div className="mb-1"><span className="font-semibold">Type :</span> {result.type}</div>
            <div className="mb-1"><span className="font-semibold">Dates :</span> {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}</div>
            <div className="mb-1"><span className="font-semibold">Lieu :</span> {result.location}</div>
            <div className="mb-1"><span className="font-semibold">Formateur :</span> {result.instructor}</div>
            <div className="mb-1"><span className="font-semibold">Statut :</span> <span className="inline-block px-2 py-1 rounded bg-green-600 text-white text-xs ml-1">{result.status}</span></div>
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