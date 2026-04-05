import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/error-handler';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  try {
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0;
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';

    const where: Prisma.FormationWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    const formations = await prisma.formation.findMany({
      where,
      select: { 
        id: true, 
        name: true, 
        category: true, 
        description: true,
        skills: true
      },
      ...(limit ? { take: limit } : {}),
      skip: offset,
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(formations);
  } catch (error: unknown) {
    return handleApiError(error, { route: '/api/public/formations' });
  }
}
