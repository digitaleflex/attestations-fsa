import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        parts: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: true
              }
            }
          }
        },
        sessions: true
      }
    });

    if (!exam) {
      return NextResponse.json({ message: "Examen non trouvé" }, { status: 404 });
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la récupération de l'examen" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, status, scheduledAt, parts } = body;

    // Use a transaction to ensure atomic update
    const exam = await prisma.$transaction(async (tx) => {
      // 1. Update basic exam info
      await tx.exam.update({
        where: { id },
        data: {
          title,
          description,
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        }
      });

      // 2. If parts are provided, we replace them
      // This is the simplest way to handle complex nested updates
      if (parts && Array.isArray(parts)) {
        // Delete all existing parts (Cascade will handle questions and options)
        await tx.examPart.deleteMany({
          where: { examId: id }
        });

        // Re-create new parts with their questions and options
        for (const part of parts) {
          await tx.examPart.create({
            data: {
              examId: id,
              title: part.title,
              type: part.type,
              duration: part.duration,
              points: part.points,
              order: part.order,
              scenario: part.scenario,
              questions: {
                create: part.questions?.map((q: any) => ({
                  text: q.text,
                  type: q.type,
                  points: q.points,
                  order: q.order,
                  options: {
                    create: q.options?.map((o: any) => ({
                      text: o.text,
                      isCorrect: o.isCorrect
                    }))
                  }
                }))
              }
            }
          });
        }
      }

      // Return the updated exam with all relations
      return await tx.exam.findUnique({
        where: { id },
        include: {
          parts: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  options: true
                }
              }
            }
          }
        }
      });
    });

    return NextResponse.json(exam);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la mise à jour de l'examen" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.exam.delete({
      where: { id }
    });
    return NextResponse.json({ message: "Examen supprimé avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erreur lors de la suppression de l'examen" }, { status: 500 });
  }
}
