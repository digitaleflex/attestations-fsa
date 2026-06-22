import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

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

export const getPublicUpcomingExams = unstable_cache(
  async (limit = 3) => {
    // Only future scheduled exams (or very recent ones that are still active)
    const today = new Date();

    try {
      return await prisma.exam.findMany({
        where: {
            scheduledAt: {
                gte: new Date(today.getTime() - 24 * 60 * 60 * 1000)
            },
            status: 'PUBLISHED' // Ensure only published exams are visible
        },
        orderBy: { scheduledAt: 'asc' },
        take: limit,
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
      console.error("⚠️ [UPCOMING_EXAMS_CACHE_ERROR]", error);
      return [];
    }
  },
  ["public-upcoming-exams"],
  { revalidate: 900, tags: ["exams"] } // 15 minutes
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
