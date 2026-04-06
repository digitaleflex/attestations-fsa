import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminAuthenticated } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const attestations = await prisma.attestation.findMany({
      include: {
        formation: { select: { name: true } },
        user: { select: { email: true } }
      },
      orderBy: { issuedAt: 'desc' }
    });

    // Préparation des données pour Excel
    const data = attestations.map((a: any) => ({
      'Code unique': a.code,
      'Type': a.type,
      'Statut': a.status === 'VALIDATED' ? 'Validée' : a.status === 'REJECTED' ? 'Révoquée' : 'En attente',
      'Nom complet': a.fullName,
      'Email': a.user?.email || 'N/A',
      'Sexe': a.gender || 'N/A',
      'Formation': a.formation?.name || 'N/A',
      'Lieu': a.location,
      'Formateur': a.instructor,
      'Compagnie': a.issuingCompany,
      'Date début': a.startDate.toLocaleDateString('fr-FR'),
      'Date fin': a.endDate.toLocaleDateString('fr-FR'),
      'Théorie / 20': a.certificationScore ? (a.certificationScore / 5).toFixed(2) : 0,
      'Pratique / 20': a.stageScore ? (a.stageScore / 5).toFixed(2) : 0,
      'Moyenne / 20': (( (a.certificationScore || 0) + (a.stageScore || 0) ) / ( (a.certificationScore && a.stageScore) ? 10 : 5 )).toFixed(2),
      'Score %': ( (a.certificationScore || 0) + (a.stageScore || 0) ) / ( (a.certificationScore && a.stageScore) ? 2 : 1 ),
      'Heures formation': a.certificationHours || 0,
      'Heures stage': a.stageHours || 0,
      'Mention': a.certificationMention || 'N/A',
      'Date émission': a.issuedAt.toLocaleDateString('fr-FR')
    }));

    // Création du classeur Excel
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attestations FSA');

    // Ajustement de la largeur des colonnes (Gestion des colonnes)
    const columnWidths = [
      { wch: 20 }, // Code
      { wch: 15 }, // Type
      { wch: 12 }, // Statut
      { wch: 30 }, // Nom
      { wch: 25 }, // Email
      { wch: 8 },  // Sexe
      { wch: 35 }, // Formation
      { wch: 20 }, // Lieu
      { wch: 20 }, // Formateur
      { wch: 25 }, // Compagnie
      { wch: 12 }, // Date début
      { wch: 12 }, // Date fin
      { wch: 12 }, // Théorie
      { wch: 12 }, // Pratique
      { wch: 15 }, // Heures Certif
      { wch: 15 }, // Heures Stage
      { wch: 15 }, // Mention
      { wch: 15 }, // Date émission
    ];
    worksheet['!cols'] = columnWidths;

    // Génération du buffer Excel
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Retourne le fichier XLSX
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=FSA_ATTESTATIONS_${new Date().toISOString().split('T')[0]}.xlsx`,
      },
    });

  } catch (error) {
    console.error("Excel Export Error:", error);
    return NextResponse.json({ error: "Erreur lors de la génération Excel" }, { status: 500 });
  }
}
