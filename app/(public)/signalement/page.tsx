"use client";
import { useState } from "react";
import { AlertCircle, CheckCircle, Mail, FileText, MessageSquare, Flag } from "lucide-react";

const motifs = [
  "Suspicion de fraude",
  "Erreur dans l’attestation",
  "Attestation non reconnue",
  "Autre"
];

export default function SignalementPage() {
  const [form, setForm] = useState({ code: "", motif: motifs[0], message: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess(false);
    try {
      const res = await fetch("/api/signalement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erreur lors de l’envoi du signalement");
      setSuccess(true);
      setForm({ code: "", motif: motifs[0], message: "", email: "" });
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-gray-100 p-4">
      <div className="w-full max-w-lg mx-auto bg-white/80 backdrop-blur-md border border-red-200 rounded-2xl shadow-xl p-8 flex flex-col items-center animate-fade-in-up">
        <h1 className="text-2xl font-bold text-red-700 mb-4 flex items-center gap-2"><Flag className="w-7 h-7 text-red-600" />Signaler une attestation</h1>
        <p className="text-gray-700 mb-6 text-center">Vous avez un doute sur une attestation ? Merci de remplir ce formulaire, notre équipe analysera votre signalement dans les plus brefs délais.</p>
        {success && (
          <div className="w-full mb-4 rounded-xl border-2 border-green-400 bg-green-100/80 p-4 text-green-900 text-center font-semibold animate-fade-in flex items-center gap-2 justify-center">
            <CheckCircle className="w-6 h-6 text-green-600 animate-bounce" />
            Signalement envoyé avec succès. Merci pour votre vigilance !
          </div>
        )}
        {error && (
          <div className="w-full mb-4 rounded-xl border-2 border-red-400 bg-red-100/80 p-4 text-red-900 text-center font-semibold animate-fade-in flex items-center gap-2 justify-center">
            <AlertCircle className="w-6 h-6 text-red-600 animate-pulse" />
            {error}
          </div>
        )}
        <form className="w-full flex flex-col gap-5" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label htmlFor="code" className="block mb-1 text-gray-700 font-medium">Code d’attestation (optionnel)</label>
            <input
              id="code"
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="Code d’attestation (optionnel)"
              className="w-full px-4 pr-4 py-3 border border-gray-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-red-400 focus:border-red-400 transition placeholder-gray-400"
            />
          </div>
          <div>
            <label htmlFor="motif" className="block mb-1 text-gray-700 font-medium">Motif</label>
            <select
              id="motif"
              name="motif"
              value={form.motif}
              onChange={handleChange}
              className="w-full px-4 pr-4 py-3 border border-gray-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-red-400 focus:border-red-400 transition"
            >
              {motifs.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="message" className="block mb-1 text-gray-700 font-medium">Message</label>
            <textarea
              id="message"
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Expliquez la raison de votre signalement..."
              className="w-full px-4 pr-4 py-3 border border-gray-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-red-400 focus:border-red-400 transition placeholder-gray-400"
            />
          </div>
          <div>
            <label htmlFor="email" className="block mb-1 text-gray-700 font-medium">Votre email (optionnel)</label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Votre email (optionnel)"
              className="w-full px-4 pr-4 py-3 border border-gray-300 rounded-lg bg-white/80 focus:ring-2 focus:ring-red-400 focus:border-red-400 transition placeholder-gray-400"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 mt-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold text-lg shadow-lg hover:scale-105 hover:shadow-2xl focus:scale-105 transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Envoi en cours..." : "Envoyer le signalement"}
          </button>
        </form>
      </div>
    </div>
  );
}
