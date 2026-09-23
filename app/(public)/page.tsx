import Link from "next/link";
import { ArrowRight, Award, ClipboardCheck, GraduationCap, ShieldCheck } from "lucide-react";

export default async function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full space-y-0 pb-24 relative bg-white">
      {/* --- HERO SECTION --- */}
      <section className="relative w-full min-h-[65vh] flex flex-col items-center justify-center text-center overflow-hidden pt-20 md:pt-24 px-4 pb-12">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-6xl w-full space-y-6">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] font-black uppercase tracking-[0.3em] shadow-lg">
            <Award className="w-4 h-4" />
            FSA Bénin • Portail Officiel
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-brand-ink tracking-tight sm:tracking-tighter leading-[0.95] md:leading-[1.05] lg:max-w-5xl mx-auto px-4">
            Votre <span className="text-brand">certification</span>,{" "}
            en un clic.
          </h1>

          <p className="text-brand-muted font-bold text-base md:text-lg max-w-md mx-auto leading-relaxed px-4">
            Examens en ligne et attestations officielles de la Ferme Cité St André.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/auth">
              <button className="px-10 py-4 min-h-[48px] rounded-2xl bg-brand text-white font-bold text-base hover:bg-brand-dark hover:shadow-xl hover:-translate-y-1 transition-all active:scale-95 shadow-lg shadow-brand/30 flex items-center justify-center gap-2">
                Accéder à mon espace
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/verifier">
              <button className="px-10 py-4 min-h-[48px] rounded-2xl bg-white text-brand-ink font-bold text-base border-2 border-brand-line hover:border-brand hover:text-brand transition-all active:scale-95 flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Vérifier un certificat
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <section className="w-full max-w-7xl px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: GraduationCap, title: "Formations certifiantes", desc: "Pisciculture, agriculture et élevage — programmes validés par la direction." },
            { icon: ClipboardCheck, title: "Examens en ligne", desc: "QCM, questions ouvertes et cas pratiques, corrigés par nos experts." },
            { icon: Award, title: "Attestations officielles", desc: "Certificats scellés et vérifiables en ligne en un clic." },
          ].map((f) => (
            <div key={f.title} className="rounded-[1.25rem] border border-brand-line bg-white p-6 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-brand" />
              </div>
              <h3 className="font-black text-brand-ink text-lg mb-2">{f.title}</h3>
              <p className="text-brand-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
