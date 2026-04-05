import { prisma } from "@/lib/prisma";

/**
 * High-performance cached data fetching for the public pages of the FSA Platform.
 * Using Next.js 15/16 "use cache" directive.
 */

export async function getPublicFormations() {
  "use cache";
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
}

export async function getPublicResources() {
  "use cache";
  return await prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getPublicUpcomingExams(limit = 3) {
  "use cache";
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
}

import { unstable_cache } from "next/cache";

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
