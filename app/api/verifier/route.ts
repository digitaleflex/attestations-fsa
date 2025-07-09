import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // Validation stricte du paramètre code
  const CodeSchema = z.string().min(5, 'Code requis').max(50);
  const parse = CodeSchema.safeParse(code);
  if (!parse.success) {
    return NextResponse.json({ error: 'Code requis ou invalide', details: parse.error.errors }, { status: 400 });
  }
  const attestation = await prisma.attestation.findUnique({
    where: { code: code ?? undefined },
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