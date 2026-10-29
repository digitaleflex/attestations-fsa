import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Lock,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Formations et examens FSA",
  description:
    "Découvrez les formations et les sessions d’examen de la Ferme Agro-Piscicole Saint-André, puis envoyez une demande de préinscription.",
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
    linkLabel: "Voir les sessions",
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
    <div className="relative flex w-full flex-1 flex-col items-center overflow-hidden bg-white pb-16">
      {/* Hero : photo aquacole en fond (cover, centrée), voile blanc marqué
          à gauche pour la lisibilité du titre, version recadrée sur mobile.
          Image décorative (`aria-hidden`), contenus textuels inchangés. */}
      <section className="relative flex w-full items-center justify-center overflow-hidden px-5 py-12 sm:px-6 md:py-16">
        <div aria-hidden="true" className="absolute inset-0">
          <Image
            src="/images/hero-aquaculture-mobile.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center md:hidden"
          />
          <Image
            src="/images/hero-aquaculture.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hidden object-cover object-center md:block"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand">
            <Award className="h-4 w-4" aria-hidden="true" />
            Ferme Agro-Piscicole Saint-André · Portail officiel
          </p>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.02] tracking-tight text-brand-ink sm:text-5xl lg:text-6xl">
            Votre parcours de certification,{" "}
            <span className="text-brand">en toute clarté.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base font-medium leading-relaxed text-brand-muted md:text-lg">
            Choisissez une formation, consultez les sessions disponibles et
            présentez-vous à l’examen depuis votre espace candidat.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <Link
              href="/formations"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
              Explorer les formations
            </Link>
            <Link
              href="/examens"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white px-7 py-3.5 text-sm font-bold text-brand-ink transition hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              Voir les sessions d’examen
            </Link>
          </div>

          <p className="mt-5 text-xs font-medium leading-relaxed text-brand-muted sm:text-sm">
            La préinscription à une formation envoie une demande à
            l’équipe FSA : elle ne vaut pas inscription définitive.
          </p>

          <nav
            aria-label="Accès rapides"
            className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-brand-muted"
          >
            <Link
              href="/verifier"
              className="underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Vérifier une attestation
            </Link>
            <Link
              href="/demande-stage"
              className="underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Demande de stage
            </Link>
            <Link
              href="/contact"
              className="underline-offset-4 transition hover:text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Contact
            </Link>
          </nav>
        </div>
      </section>

      <section
        className="w-full bg-brand-line/30 px-5 py-14 sm:px-6 md:py-20"
        aria-labelledby="parcours-title"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Un parcours en trois étapes
            </p>
            <h2
              id="parcours-title"
              className="mt-3 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl"
            >
              Vous savez quoi faire à chaque étape.
            </h2>
            <p className="mt-4 text-base font-medium leading-relaxed text-brand-muted md:text-lg">
              Les informations publiques vous aident à choisir. La connexion
              intervient uniquement au moment d’accéder à votre espace candidat.
            </p>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <li
                key={step.number}
                className="flex h-full flex-col rounded-3xl border border-brand-line bg-white p-6 shadow-sm transition hover:border-brand/30 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold tracking-[0.2em] text-brand-muted/60">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-extrabold text-brand-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-brand-muted">
                  {step.description}
                </p>
                <Link
                  href={step.href}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 self-start text-sm font-bold text-brand underline-offset-4 transition hover:text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4"
                >
                  {step.linkLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="w-full px-5 py-14 sm:px-6 md:py-20" aria-labelledby="reassurance-title">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Une information fiable
            </p>
            <h2
              id="reassurance-title"
              className="mt-3 text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl"
            >
              Vérifiez avant de poursuivre.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {reassurance.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl bg-brand-ink p-6 text-white"
              >
                <item.icon className="h-6 w-6 text-brand-accent" aria-hidden="true" />
                <h3 className="mt-5 text-base font-extrabold leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/70">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
