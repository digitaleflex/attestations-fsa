import * as React from "react"
import { prisma } from "@/lib/prisma";
import { AlertCircle } from "lucide-react";

export default async function SignalementsAdminPage() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2 text-red-700">
        <AlertCircle className="w-7 h-7 text-red-600" /> Signalements reçus
      </h1>
      {reports.length === 0 ? (
        <div className="text-gray-500">Aucun signalement pour le moment.</div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div key={report.id} className="bg-white border border-red-200 rounded-xl p-4 shadow flex flex-col gap-1">
              <div className="text-sm text-gray-500">{new Date(report.createdAt).toLocaleString()}</div>
              <div className="font-semibold">Motif : <span className="text-red-700">{report.motif}</span></div>
              {report.codeAttestation && (
                <div className="text-sm text-gray-700">Code attestation : {report.codeAttestation}</div>
              )}
              <div className="text-gray-800">{report.message}</div>
              {report.email && (
                <div className="text-xs text-gray-500">Email : {report.email}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 