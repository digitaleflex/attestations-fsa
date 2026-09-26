import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { VISIBLE_EXAM_STATUSES } from "@/lib/exams/availability";
import { hasOpened, opensOn } from "@/lib/exams/time";

/**
 * High-performance cached data fetching for the public pages of the FSA Platform.
 * Using Next.js unstable_cache for compatibility (avoiding "use cache" directive).
 */

export const getPublicFormations = unstable_cache(
  async () => {
    try {
      return await prisma.formation.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            category: true,
            description: true,
            skills: true
        }
      });
    } catch (error) {
      console.error("⚠️ [FORMATIONS_CACHE_ERROR]", error);
      return [];
    }
  },
  ["public-formations"],
  { revalidate: 3600, tags: ["formations"] } // 1 hour
);

export type PublicUpcomingExam = {
  id: string;
  name: string | null;
  title: string | null;
  status: string;
  scheduledAt: Date | null;
  /** Journée d'ouverture (minuit `APP_TIMEZONE`), en ISO. */
  opensOn: string | null;
  /** Alias d'annonces : même instant que `opensOn`. */
  opensAt: string | null;
  /** Présents UNIQUEMENT pour un examen déjà ouvert. */
  description?: string | null;
  duration?: number | null;
};

/** #256 m9 — forme réduite : aucun contenu d'examen avant l'ouverture. */
function toPublicUpcomingExam(
  row: {
    id: string;
    name: string | null;
    title: string | null;
    description: string | null;
    scheduledAt: Date | null;
    opensOn: Date | null;
    duration: number | null;
    status: string;
  },
  now: Date,
): PublicUpcomingExam {
  const opensAt = opensOn(row);
  const opensAtIso = opensAt ? opensAt.toISOString() : null;
  if (hasOpened(row, now)) {
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduledAt,
      opensOn: opensAtIso,
      opensAt: opensAtIso,
      description: row.description,
      duration: row.duration,
    };
  }
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduledAt,
    opensOn: opensAtIso,
    opensAt: opensAtIso,
  };
}

export const getPublicUpcomingExams = unstable_cache(
  async (limit = 3): Promise<PublicUpcomingExam[]> => {
    try {
      const now = new Date();
      const rows = await prisma.exam.findMany({
        where: {
          status: { in: [...VISIBLE_EXAM_STATUSES] },
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
        select: {
            id: true,
            name: true,
            title: true,
            description: true,
            scheduledAt: true,
            opensOn: true,
            duration: true,
            status: true,
        }
      });
      // #256 m9 — forme réduite pour un examen NON ouvert : les clés de
      // contenu (description, durée) sont ABSENTES, pas nulles. Le compte à
      // rebours se cale sur `opensOn` / `scheduledAt`, rien d'autre ne sort.
      return rows.map((row) => toPublicUpcomingExam(row, now));
    } catch (error) {
      console.error("⚠️ [UPCOMING_EXAMS_CACHE_ERROR]", error);
      return [];
    }
  },
  ["public-upcoming-exams"],
  { revalidate: 900, tags: ["exams"] } // 15 minutes
);

export const getPublicAllExams = unstable_cache(
  async () => {
    try {
      return await prisma.exam.findMany({
        where: {
          status: { in: [...VISIBLE_EXAM_STATUSES] },
        },
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          name: true,
          title: true,
          description: true,
          scheduledAt: true,
          duration: true,
          status: true,
        }
      });
    } catch (error) {
      console.error("⚠️ [ALL_EXAMS_CACHE_ERROR]", error);
      return [];
    }
  },
  ["public-all-exams"],
  { revalidate: 900, tags: ["exams"] }
);

export const getPublicStats = unstable_cache(
    async () => {
        try {
            const validated = await prisma.attestation.count({ where: { status: 'VALIDATED' } });
            const pending = await prisma.attestation.count({ where: { status: 'PENDING' } });

            return {
                validated: (validated || 0) + 540, // Base history + dynamic count
                pending: (pending || 0) + 12
            };
        } catch (error) {
            console.error("⚠️ [STATS_CACHE_ERROR] Plan limit reached or DB error:", error);
            // Fallback values to keep UI alive
            return {
                validated: 540,
                pending: 12
            };
        }
    },
    ["public-impact-stats"],
    { revalidate: 86400, tags: ["stats"] } // 24 hours
);
