import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { ids, columns } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Aucun ID sélectionné" }, { status: 400 });
    }

    const attestations = await prisma.attestation.findMany({
      where: { id: { in: ids } },
      include: { formation: true, user: true }
    });

    // Transformer les données pour Excel en fonction des colonnes sélectionnées
    const excelData = attestations.map((a: {
      fullName: string;
      code: string;
      type: string;
      status: string;
      issuedAt: Date | null;
      certificationScore: number;
      stageScore: number;
      location: string | null;
      instructor: string | null;
      formation?: { name: string } | null;
    }) => {
      const row: any = {};
      if (columns.includes("fullName")) row["Nom complet"] = a.fullName;
      if (columns.includes("code")) row["Code"] = a.code;
      if (columns.includes("formation")) row["Formation"] = a.formation?.name || "-";
      if (columns.includes("type")) row["Type"] = a.type;
      if (columns.includes("status")) row["Statut"] = a.status;
      if (columns.includes("issuedAt")) row["Date d'émission"] = a.issuedAt ? new Date(a.issuedAt).toLocaleDateString("fr-FR") : "-";
      if (columns.includes("certificationScore")) row["Score Certification"] = a.certificationScore || 0;
      if (columns.includes("stageScore")) row["Score Stage"] = a.stageScore || 0;
      if (columns.includes("location")) row["Lieu"] = a.location;
      if (columns.includes("instructor")) row["Instructeur"] = a.instructor;
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attestations");

    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Pour un téléchargement direct, on pourrait renvoyer le buffer avec les bons headers
    // Mais via fetch, on peut renvoyer le buffer en base64 ou utiliser une autre méthode
    // Ici, on va renvoyer le buffer directement
    
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=attestations-custom-${new Date().getTime()}.xlsx`,
      },
    });

  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: "Erreur lors de l'exportation" }, { status: 500 });
  }
}
