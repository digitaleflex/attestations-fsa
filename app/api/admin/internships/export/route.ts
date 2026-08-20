import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, string> = status && status !== "ALL" ? { status } : {};

    const requests = await prisma.internshipRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Prepare data for Excel
    const data = requests.map((r) => ({
      Nom: r.fullName,
      Email: r.email,
      Téléphone: r.phone,
      Poste: r.position,
      Université: r.university || "",
      Niveau: r.level || "",
      Statut: r.status,
      Message: r.message || "",
      "Date de demande": new Date(r.createdAt).toLocaleDateString("fr-FR"),
      "Lien CV": r.cvUrl || "",
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws["!cols"] = [
      { wch: 25 }, // Nom
      { wch: 30 }, // Email
      { wch: 15 }, // Téléphone
      { wch: 20 }, // Poste
      { wch: 20 }, // Université
      { wch: 15 }, // Niveau
      { wch: 12 }, // Statut
      { wch: 40 }, // Message
      { wch: 15 }, // Date
      { wch: 30 }, // Lien CV
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Stages");

    // Generate buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="stages-${
          new Date().toISOString().split("T")[0]
        }.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[INTERNSHIP_EXPORT_ERROR]", error);
    return NextResponse.json(
      { error: "Erreur lors de l'export" },
      { status: 500 }
    );
  }
}
