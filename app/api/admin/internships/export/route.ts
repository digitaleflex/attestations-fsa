import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/auth";
import { handleApiError } from "@/lib/error-handler";
import { applyRateLimit } from "@/lib/rate-limit";
import {
  buildPagination,
  internshipExportQuerySchema,
} from "@/lib/internships/schemas";
import { auditInternshipExport } from "@/lib/internships/mutation";

export async function GET(request: NextRequest) {
  const adminUser = await getAdminUser(request);
  if (!adminUser) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const rateLimit = await applyRateLimit(request, "api");
  if (!rateLimit.allowed && rateLimit.response) {
    return rateLimit.response;
  }

  try {
    // #267 — l'export est paginé comme la liste : `?page=&pageSize=&status=`.
    // Un export « sans limite » d'un export massif n'est plus possible.
    const { searchParams } = new URL(request.url);
    const query = internshipExportQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const where = query.status ? { status: query.status } : {};

    const [requests, total] = await Promise.all([
      prisma.internshipRequest.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
      }),
      prisma.internshipRequest.count({ where }),
    ]);

    // 🛡️ Audit : un export de données personnelles est une action traçable.
    await auditInternshipExport({
      adminUser,
      page: query.page,
      pageSize: query.pageSize,
      total,
      status: query.status,
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
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
      // Jamais d'URL signée dans un export : on expose la clé stable
      // (`cvKey`) pour les objets #260, l'URL historique pour l'ancien.
      "Lien CV": r.cvUrl || r.cvKey || "",
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

    const pagination = buildPagination(query, total);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="stages-${
          new Date().toISOString().split("T")[0]
        }.xlsx"`,
        // #267 — l'UI affiche « page X / Y (N demandes) » à partir de ces
        // en-têtes, sans avoir à re-parser le fichier.
        "X-Total-Count": String(pagination.total),
        "X-Page": String(pagination.page),
        "X-Page-Size": String(pagination.pageSize),
        "X-Total-Pages": String(pagination.totalPages),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Paramètres invalides",
          code: "INVALID_QUERY",
          details: error.errors.map((e) => ({
            field: e.path.join(".") || "unknown",
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    console.error("[INTERNSHIP_EXPORT_ERROR]", error);
    return handleApiError(error, {
      route: "/api/admin/internships/export",
      operation: "GET",
      userId: adminUser?.id,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });
  }
}
