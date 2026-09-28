import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, CheckCircle, Trophy, ArrowRight, AlertTriangle, RotateCw,
} from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { captureServerError } from "@/lib/observability/sentry-capture";

/** Un compteur, avec la trace de son éventuel échec. */
type Counter = { value: number | null; failed: boolean };

/**
 * Un compteur qui ne fait pas tomber la page (#84).
 *
 * Le détail de l'échec part dans le journal serveur et chez Sentry — il n'est
 * jamais renvoyé au navigateur. L'écran admin affiche `null` (un tiret), pas un
 * message technique, pas un nom de table.
 */
async function countSafely(
  operation: string,
  run: () => Promise<number>,
): Promise<Counter> {
  try {
    return { value: await run(), failed: false };
  } catch (error) {
    console.error(`[admin/dashboard] Compteur en échec : ${operation}`, error);
    captureServerError(error, {
      route: "/admin/dashboard",
      operation: `dashboard:${operation}`,
    });
    return { value: null, failed: true };
  }
}

async function getDashboardData() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers, newUsersThisMonth, totalAdmins, totalAttestations, validatedExams, pendingCorrections] =
    await Promise.all([
      countSafely("users.total", () => prisma.user.count()),
      countSafely("users.newThisMonth", () =>
        prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      ),
      countSafely("users.admins", () =>
        prisma.user.count({ where: { role: "admin" } }),
      ),
      countSafely("attestations.total", () => prisma.attestation.count()),
      countSafely("exams.validated", () =>
        prisma.examSession.count({ where: { status: "PASSED" } }),
      ),
      countSafely("corrections.pending", () => prisma.correctionRequest.count()),
    ]);

  // On ne compte que les compteurs AFFICHÉS : `users.admins` ne sert qu'au
  // total de candidats, non présent sur l'écran. Compter les six ferait
  // annoncer « un indicateur manquant » alors qu'aucun tiret n'apparaît.
  const displayed = [
    totalUsers,
    newUsersThisMonth,
    totalAttestations,
    validatedExams,
    pendingCorrections,
  ];
  const failures = displayed.filter((counter) => counter.failed).length;

  // Aucun indicateur lisible : l'écran ne porterait que des tirets, ce qui se
  // lit comme une base vide. On rend la main à `app/admin/error.tsx`, qui
  // présente l'incident et propose un nouvel essai.
  if (failures === displayed.length) {
    throw new Error(
      "Tableau de bord indisponible : aucun indicateur n'a pu être lu.",
    );
  }

  const candidates =
    totalUsers.value !== null && totalAdmins.value !== null
      ? totalUsers.value - totalAdmins.value
      : null;

  return {
    stats: {
      total: totalAttestations.value,
      validated: validatedExams.value,
    },
    usersStats: {
      total: totalUsers.value,
      newThisMonth: newUsersThisMonth.value,
      admins: totalAdmins.value,
      candidates,
    },
    corrections: pendingCorrections.value,
    /** Nombre de compteurs illisibles — pilote l'avertissement sous l'en-tête. */
    failures,
  };
}

/**
 * Grand chiffre. Un compteur illisible ne doit pas laisser croire à un zéro :
 * l'emplacement garde sa place (pas de saut de mise en page) et porte un tiret
 * annoncé comme tel aux lecteurs d'écran.
 */
function Figure({ value, label }: { value: number | null; label: string }) {
  if (value !== null) {
    return <p className="text-3xl font-black text-brand-ink">{value}</p>;
  }
  return (
    <p className="text-3xl font-black text-brand-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label} : indisponible</span>
    </p>
  );
}

/** Légende sous un chiffre : même règle, formulée en mots. */
function FigureCaption({ value, suffix }: { value: number | null; suffix: string }) {
  return (
    <p className="text-xs text-brand-muted mt-1">
      {value === null ? "Valeur indisponible" : `${value} ${suffix}`}
    </p>
  );
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 min-h-screen animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge className="bg-brand/10 text-brand border-brand/20 px-3 py-1 text-[10px] uppercase font-black tracking-widest">
            Console Admin
          </Badge>
          <h1 className="text-4xl font-black text-brand-ink tracking-tight">
            Bonjour Admin,
          </h1>
          <p className="text-brand-muted text-sm md:text-base font-medium">
            Vue d'ensemble des attestations, examens et inscriptions.
          </p>
        </div>
        <Link href="/admin/users">
          <button className="px-6 py-3 rounded-2xl bg-brand text-white font-bold text-sm hover:bg-brand-dark shadow-lg shadow-brand/20 transition-all active:scale-95 flex items-center gap-2">
            Gérer les utilisateurs
            <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
      </div>

      {/* Données partielles : l'échec est annoncé, jamais masqué. `role="status"`
          (annonce polie) suffit — rien n'est en danger, et un `role="alert"`
          interromprait la lecture d'un administrateur au clavier. La relance
          passe par une vraie navigation `<a>` (et non `Link`) : le compteur
          est recalculé par le serveur, ce qu'une navigation cliente vers la
          même URL n'est pas capable de garantir. */}
      {data.failures > 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
            />
            <p className="text-sm text-amber-900">
              {data.failures === 1
                ? "Un indicateur n’a pas pu être récupéré. Le chiffre concerné est remplacé par un tiret."
                : `${data.failures} indicateurs n’ont pas pu être récupérés. Les chiffres concernés sont remplacés par un tiret.`}
            </p>
          </div>
          <a
            href="/admin/dashboard"
            className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-amber-600 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 sm:self-auto"
          >
            <RotateCw aria-hidden="true" className="h-4 w-4" />
            Recharger
          </a>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold text-brand-ink mb-4">Vue d'ensemble</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
              <UserPlus className="w-6 h-6 text-brand" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Inscrits ce mois-ci</p>
            <Figure value={data.usersStats.newThisMonth} label="Inscrits ce mois-ci" />
            <FigureCaption value={data.usersStats.total} suffix="candidats totaux" />
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center mb-6">
              <Trophy className="w-6 h-6 text-brand-accent" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Attestations</p>
            <Figure value={data.stats.total} label="Attestations" />
            <FigureCaption value={data.stats.validated} suffix="validées" />
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-6 h-6 text-brand" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Examens validés</p>
            <Figure value={data.stats.validated} label="Examens validés" />
            <p className="text-xs text-brand-muted mt-1">Sessions terminées</p>
          </Card>

          <Card className="p-6 border-none shadow-sm bg-white rounded-3xl group hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6">
              <UserPlus className="w-6 h-6 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-brand-muted mb-1">Corrections</p>
            <Figure value={data.corrections} label="Demandes de correction en attente" />
            <p className="text-xs text-brand-muted mt-1">Demandes en attente</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
