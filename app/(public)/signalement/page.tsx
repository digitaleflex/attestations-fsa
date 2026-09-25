"use client";
import { useState } from "react";
import { AlertCircle, CheckCircle, ShieldAlert } from "lucide-react";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-28 md:py-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 h-[34rem] w-[34rem] rounded-full bg-rose-100/60 blur-[110px]" />
        <div className="absolute -bottom-28 -left-20 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-white bg-white/80 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10 animate-fade-in-up">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-rose-500 to-brand" />
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-50 text-rose-600 ring-1 ring-rose-100">
          <ShieldAlert aria-hidden="true" className="h-9 w-9" />
        </div>
        <div className="mb-8 text-center">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-rose-700">Service de vigilance</p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Signaler une attestation</h1>
          <p className="mt-3 text-sm font-medium leading-7 text-slate-500">Vous avez un doute sur une attestation ? Décrivez-le à notre équipe, qui examinera votre signalement.</p>
        </div>
        {success && (
          <div role="status" aria-live="polite" className="w-full mb-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-900 text-center font-semibold animate-fade-in flex items-center gap-2 justify-center">
            <CheckCircle className="w-6 h-6 text-green-600 animate-bounce" />
            Signalement envoyé avec succès. Merci pour votre vigilance !
          </div>
        )}
        {error && (
          <div role="alert" aria-live="assertive" className="w-full mb-4 rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-rose-900 text-center font-semibold animate-fade-in flex items-center gap-2 justify-center">
            <AlertCircle className="w-6 h-6 text-red-600 animate-pulse" />
            {error}
          </div>
        )}
        <form className="w-full flex flex-col gap-5" onSubmit={handleSubmit} autoComplete="off" aria-busy={loading}>
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
            className="w-full h-14 mt-2 rounded-2xl bg-slate-950 text-white font-black uppercase tracking-[0.12em] text-xs shadow-xl shadow-brand/10 hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Envoi en cours..." : "Envoyer le signalement"}
          </button>
        </form>
      </div>
    </main>
  );
}
