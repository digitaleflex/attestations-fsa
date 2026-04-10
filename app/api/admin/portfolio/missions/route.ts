import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: Request) {
  if (!await isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const missions = await prisma.portfolioMission.findMany({
      include: {
        formation: { select: { name: true } },
        _count: { select: { userMissions: { where: { status: 'COMPLETED' } } } }
      },
      orderBy: { order: 'asc' }
    });
    return NextResponse.json(missions);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mission = await prisma.portfolioMission.create({
      data: {
        title: body.title,
        description: body.description,
        type: body.type || 'EXERCISE',
        guideMarkdown: body.guideMarkdown || null,
        requiredExamId: body.requiredExamId || null,
        minScoreRequired: parseFloat(body.minScoreRequired) || 13,
        order: parseInt(body.order) || 0,
        formationId: body.formationId === 'all' ? null : (body.formationId || null),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }
    });
    return NextResponse.json(mission);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!await isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;
    const mission = await prisma.portfolioMission.update({
      where: { id },
      data: {
        ...data,
        order: data.order ? parseInt(data.order) : undefined,
        minScoreRequired: data.minScoreRequired ? parseFloat(data.minScoreRequired) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        formationId: data.formationId === 'all' ? null : data.formationId,
      }
    });
    return NextResponse.json(mission);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    if (!await isAdminAuthenticated(request)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  
      await prisma.portfolioMission.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }
}
