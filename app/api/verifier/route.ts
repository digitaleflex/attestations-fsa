import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // Validation stricte du paramètre code (min 5 caractères pour supporter la recherche courte)
  const CodeSchema = z.string().min(5, 'Code requis (minimum 5 caractères)').max(50);
  const parse = CodeSchema.safeParse(code);
  if (!parse.success) {
    return NextResponse.json({ error: 'Code requis ou invalide (minimum 5 caractères)', details: parse.error.errors }, { status: 400 });
  }

  const validCode = parse.data.trim();
  let attestation;

  // Si le code fait 5 caractères ou moins, chercher par suffixe (les 5 derniers caractères)
  // Sinon, chercher par correspondance exacte
  if (validCode.length <= 5) {
    attestation = await prisma.attestation.findFirst({
      where: { code: { endsWith: validCode } },
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
  } else {
    attestation = await prisma.attestation.findUnique({
      where: { code: validCode },
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
  }

  if (!attestation) {
    return NextResponse.json({ error: "Aucune attestation trouvée pour ce code." }, { status: 404 });
  }
  return NextResponse.json({ attestation });
}
 