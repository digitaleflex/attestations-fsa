import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Activity, CalendarDays, CheckCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VISIBLE_EXAM_STATUSES } from "@/lib/exams/availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getFormationBySlug(slug: string) {
  const decoded = decodeURIComponent(slug);
  // L'identifiant public stable est l'id ; on accepte aussi le nom
  // slugifié pour des URL lisibles.
  const byId = await prisma.formation.findUnique({
    where: { id: decoded },
    select: { id: true, name: true, category: true, description: true, skills: true },
  });
  if (byId) return byId;

  const all = await prisma.formation.findMany({
    select: { id: true, name: true, category: true, description: true, skills: true },
  });
  return all.find((f) => slugify(f.name) === slugify(decoded)) ?? null;
}

async function getLinkedSessions(formationId: string) {
  try {
    return await prisma.exam.findMany({
      where: {
        formationId,
        status: { in: [...VISIBLE_EXAM_STATUSES] },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        session: true,
        scheduledAt: true,
        opensOn: true,
        status: true,
      },
    });
  } catch {
    return [];
  }
}

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(value);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const formation = await getFormationBySlug(slug);
  if (!formation) return { title: "Formation introuvable" };
  return {
    title: formation.name,
    description: formation.description ?? `Présentation de la formation ${formation.name} proposée par la FSA.`,
  };
}

export default async function FormationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const formation = await getFormationBySlug(slug);
  if (!formation) notFound();

  const sessions = await getLinkedSessions(formation.id);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-white font-sans selection:bg-brand selection:text-white">
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 md:pt-14">
        <Link
          href="/formations"
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 py-2 text-sm font-bold text-brand-muted transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Retour au catalogue
        </Link>

        <div className="mt-4">
          <Badge variant="outline" className="rounded-full border-brand/20 bg-brand/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-dark">
            {formation.category}
          </Badge>
        </div>

        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-brand-ink sm:text-4xl md:text-5xl">
          {formation.name}
        </h1>

        {formation.description && (
          <p className="mt-4 text-sm font-normal leading-relaxed text-brand-muted md:text-base">
            {formation.description}
          </p>
        )}

        {formation.skills.length > 0 && (
          <section aria-labelledby="detail-skills" className="mt-8 rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6">
            <h2 id="detail-skills" className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-brand-ink">
              <Activity className="h-4 w-4 text-brand" aria-hidden="true" />
              Compétences visées
            </h2>
            <ul className="mt-4 space-y-3">
              {formation.skills.map((skill, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm font-medium leading-relaxed text-brand-ink">{skill}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sessions.length > 0 && (
          <section aria-labelledby="detail-sessions" className="mt-6 rounded-2xl border border-brand-line bg-white p-5 shadow-sm md:p-6">
            <h2 id="detail-sessions" className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-brand-ink">
              <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
              Sessions liées
            </h2>
            <ul className="mt-4 space-y-3">
              {sessions.map((s) => {
                const date = formatDate(s.scheduledAt ?? s.opensOn);
                const label = s.session ?? s.title ?? s.name;
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-1 rounded-2xl border border-brand-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm font-bold text-brand-ink">{label}</span>
                    {date && (
                      <span className="text-xs font-medium text-brand-muted">{date}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mt-8 rounded-2xl border border-brand/20 bg-brand/[0.03] p-5 text-center md:p-6">
          <Button asChild className="min-h-11 w-full rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:w-auto">
            <Link href={`/formations/inscription?formationId=${formation.id}`}>
              Je souhaite cette formation
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </Button>
          <p className="mx-auto mt-3 max-w-md text-xs font-medium leading-relaxed text-brand-muted">
            La préinscription exprime votre intérêt. L’envoi du formulaire transmet
            votre demande et ne confirme pas à lui seul l’inscription.
          </p>
        </div>
      </div>
    </div>
  );
}
