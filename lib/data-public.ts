import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

/**
 * High-performance cached data fetching for the public pages of the FSA Platform.
 * Using Next.js unstable_cache for compatibility (avoiding "use cache" directive).
 */

export const getPublicFormations = unstable_cache(
  async () => {
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
  },
  ["public-formations"],
  { revalidate: 3600, tags: ["formations"] } // 1 hour
);

export const getPublicResources = unstable_cache(
  async () => {
    return await prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
    });
  },
  ["public-resources"],
  { revalidate: 1800, tags: ["resources"] } // 30 minutes
);

export const getPublicUpcomingExams = unstable_cache(
  async (limit = 3) => {
    // Only future scheduled exams (or very recent ones that are still active)
    const today = new Date();

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
  },
  ["public-upcoming-exams"],
  { revalidate: 900, tags: ["exams"] } // 15 minutes
);

export const getPublicStats = unstable_cache(
    async () => {
        const validated = await prisma.attestation.count({ where: { status: 'VALIDATED' } });
        const pending = await prisma.attestation.count({ where: { status: 'PENDING' } });

        return {
            validated: validated + 540, // Base history + dynamic count
            pending: pending + 12
        };
    },
    ["public-impact-stats"],
    { revalidate: 86400, tags: ["stats"] } // 24 hours
);
