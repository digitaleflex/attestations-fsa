import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { VISIBLE_EXAM_STATUSES } from '@/lib/exams/availability';

export const revalidate = 3600; // Cache results for 1 hour

export async function GET() {
    try {
        const exams = await prisma.exam.findMany({
            where: {
                status: { in: [...VISIBLE_EXAM_STATUSES] },
            },
            select: {
                id: true,
                title: true,
                name: true,
                description: true,
                scheduledAt: true,
                duration: true,
                status: true,
                totalPoints: true,
            },
            orderBy: {
                scheduledAt: 'asc',
            },
            take: 6, // Limit for public view
        });

        const response = NextResponse.json(exams, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59',
            },
        });

        return response;
    } catch (error) {
        console.error('[API PUBLIC EXAMS] Error:', error);
        return NextResponse.json(
            { message: 'Erreur lors de la récupération des examens' },
            { status: 500 }
        );
    }
}
