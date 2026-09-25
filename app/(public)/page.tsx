import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Lock,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Formations et examens FSA",
  description:
    "Découvrez les formations et les sessions d’examen de la Ferme Cité St André, puis straighten les modalités avant de candidater.",
};

const steps = [
  {
    number: "01",
    icon: GraduationCap,
    title: "Choisissez votre formation",
    description:
      "Parcourez les domaines, contenus et compétences annoncés pour identifier la formation qui correspond à votre projet.",
    href: "/formations",
    linkLabel: "Explorer les formations",
  },
  {
    number: "02",
    icon: CalendarDays,
    title: "Consultez les sessions",
    description:
      "Repérez la date et la durée de l’examen, et vérifiez si la session est ouverte ou encore à venir.",
    href: "/examens",
    linkLabel: "Voir les examens",
  },
  {
    number: "03",
    icon: ClipboardCheck,
    title: "Passez l’examen",
    description:
      "Connectez-vous avec votre compte candidat pour accéder à la session lorsqu’elle est ouverte.",
    href: "/auth",
    linkLabel: "Accéder à mon espace",
  },
];

const reassurance = [
  {
    icon: SearchCheck,
    title: "Des informations avant de vous engager",
    description:
      "Les dates, durées et statuts des sessions sont affichés publiquement.",
  },
  {
    icon: Lock,
    title: "Un accès lié à votre compte",
    description:
      "Les sessions à venir restent informatives ; leur accès s’effectue depuis votre espace.",
  },
  {
    icon: ShieldCheck,
    title: "Une attestation contrôlable",
    description:
      "Une attestation obtenue pourra être vérifiée avec son code d’authenticité.",
  },
];

export default function Home() {
  return (
    <div className="relative flex w-full flex-1 flex-col items-center overflow-hidden bg-white pb-24">
      <section className="relative flex min-h-[78svh] w-full items-center justify-center overflow-hidden px-5 py-20 sm:px-6 md:py-28 lg:min-h-[720px]">
        <div className="absolute left-1/2 top-8 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-brand/10 blur-[100px] sm:h-[700px] sm:w-[700px]" />
        <div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-brand-accent/15 blur-3xl" />
        <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-brand/20 bg-brand/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand sm:px-5 sm:tracking-[0.25em]">
                <Award className="h-4 w-4" aria-hidden="true" />
                Ferme Cité St André · Portail officiel
              </div>

              <h1 className="mt-7 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-brand-ink sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
                Votre parcours de certification,{" "}
                <span className="text-brand">en toute clarté.</span>
              </h1>

              <p className="mx-auto mt-7 max-w-xl text-base font-medium leading-relaxed text-brand-muted md:text-lg lg:mx-0">
                Choisissez une formation, consultez les sessions disponibles et
                présentez-vous à l’examen depuis votre espace candidat.
              </p>

              <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/examens"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-7 py-4 text-sm font-black text-white shadow-xl shadow-brand/20 transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  Découvrir les examens
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/formations"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-brand-line bg-white px-7 py-4 text-sm font-black text-brand-ink transition hover:-translate-y-0.5 hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                  Voir les formations
                </Link>
              </div>

              <p className="mt-5 text-xs font-semibold leading-relaxed text-slate-500 sm:text-sm">
                Une préinscription de formation déclenche votre demande. Elle reste
                à confirmer avec l’équipe FSA.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -inset-4 rotate-2 rounded-[2.5rem] bg-brand/5 sm:-inset-6" />
              <div className="relative overflow-hidden rounded-[2rem] border border-brand-line bg-white p-6 shadow-[0_30px_80px_rgba(9,31,27,0.12)] sm:rounded-[2.5rem] sm:p-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Aperçu du parcours
                    </p>
                    <p className="mt-1 text-lg font-black text-brand-ink">
                      Avant de commencer
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                <ol className="divide-y divide-slate-100">
                  {[
                    ["Formation", "Programme et compétences"],
                    ["Session", "Date, durée et statut"],
                    ["Compte", "Connexion puis passage"],
                  ].map(([label, detail], index) => (
                    <li
                      key={label}
                      className="flex items-center gap-4 py-5 sm:gap-5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-brand-ink">{label}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                          {detail}
                        </p>
                      </div>
                      <CheckCircle2
                        className="ml-auto h-5 w-5 shrink-0 text-brand"
                        aria-label="Étape disponible"
                      />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="w-full bg-slate-50/80 px-5 py-20 sm:px-6 md:py-28"
        aria-labelledby="parcours-title"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
              Un parcours en trois étapes
            </p>
            <h2
              id="parcours-title"
              className="mt-4 text-3xl font-black tracking-tight text-brand-ink sm:text-4xl md:text-5xl"
            >
              Vous savez quoi faire à chaque étape.
            </h2>
            <p className="mt-5 text-base font-medium leading-relaxed text-slate-600 md:text-lg">
              Les informations publiques vous aident à choisir. La connexion
              intervient uniquement au moment d’accéder à votre espace candidat.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="group flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-white">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-black tracking-[0.2em] text-slate-300">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-8 text-xl font-black text-brand-ink">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                  {step.description}
                </p>
                <Link
                  href={step.href}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 self-start text-sm font-black text-brand underline-offset-4 transition hover:text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4"
                >
                  {step.linkLabel}
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="w-full px-5 py-20 sm:px-6 md:py-28" aria-labelledby="reassurance-title">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
                Une information fiable
              </p>
              <h2
                id="reassurance-title"
                className="mt-4 text-3xl font-black tracking-tight text-brand-ink sm:text-4xl"
              >
                Vérifiez avant de poursuivre.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {reassurance.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-brand-line bg-brand-ink p-6 text-white sm:p-5 xl:p-6"
                >
                  <item.icon className="h-6 w-6 text-brand-accent" aria-hidden="true" />
                  <h3 className="mt-6 text-base font-black leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-white/65">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
