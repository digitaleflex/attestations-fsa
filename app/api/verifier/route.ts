import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Code requis' }, { status: 400 });
  }
  const attestation = await prisma.attestation.findUnique({
    where: { code },
    select: {
      fullName: true,
      type: true,
      status: true,
      startDate: true,
      endDate: true,
      location: true,
      instructor: true,
      formation: {
        select: {
          name: true,
          category: true,
        }
      }
    }
  });
  if (!attestation) {
    return NextResponse.json({ error: "Aucune attestation trouvée pour ce code." }, { status: 404 });
  }
  return NextResponse.json({ attestation });
} 