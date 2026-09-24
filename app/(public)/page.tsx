import Link from "next/link";
import { ArrowRight, Award, ClipboardCheck, GraduationCap, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center w-full pb-24 relative bg-white">
      {/* HERO */}
      <section className="relative w-full min-h-[70vh] flex flex-col items-center justify-center text-center pt-24 md:pt-32 px-6 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-brand/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl w-full space-y-8">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-black uppercase tracking-[0.3em] shadow-sm">
            <Award className="w-4 h-4" />
            FSA Bénin · Portail Officiel
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-brand-ink tracking-tight sm:tracking-tighter leading-[0.95]">
            Votre certification,
            <span className="text-brand"> en un clic</span>.
          </h1>

          <p className="text-brand-muted font-medium text-base md:text-lg max-w-md mx-auto leading-relaxed">
            Examens en ligne et attestations officielles de la Ferme Cité St André.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth">
              <button className="px-10 py-4 min-h-[52px] rounded-2xl bg-brand text-white font-bold text-base hover:bg-brand-dark hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 shadow-lg shadow-brand/20 flex items-center justify-center gap-2">
                Accéder à mon espace
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/verifier">
              <button className="px-10 py-4 min-h-[52px] rounded-2xl bg-white text-brand-ink font-bold text-base border-2 border-brand-line hover:border-brand hover:text-brand transition-all active:scale-95 flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Vérifier un certificat
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="w-full max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: GraduationCap, title: "Formations certifiantes", desc: "Pisciculture, agriculture et élevage — programmes validés par la direction." },
            { icon: ClipboardCheck, title: "Examens en ligne", desc: "QCM, questions ouvertes et cas pratiques, corrigés par nos experts." },
            { icon: Award, title: "Attestations officielles", desc: "Certificats scellés et vérifiables en ligne en un clic." },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-brand-line bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
                <f.icon className="w-7 h-7 text-brand" />
              </div>
              <h3 className="font-black text-brand-ink text-xl mb-3">{f.title}</h3>
              <p className="text-brand-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}