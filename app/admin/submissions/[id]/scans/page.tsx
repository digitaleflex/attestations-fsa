"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Upload, FileText, Image, X, CheckCircle, AlertCircle, 
  Eye, Trash2, Download, ArrowLeft
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function AdminSubmissionScansPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: submission, isLoading } = useQuery({
    queryKey: ["submission", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/submissions/${id}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/admin/submissions/${id}/scans`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      setSelectedFiles([]);
      toast.success("✅ Scans uploadés avec succès !");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'upload");
    },
  });

  const deleteScanMutation = useMutation({
    mutationFn: async (scanId: string) => {
      const res = await fetch(`/api/admin/submissions/${id}/scans/${scanId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submission", id] });
      toast.success("Scan supprimé");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast.error("Sélectionnez au moins un fichier");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("scans", file);
    });

    uploadMutation.mutate(formData);
  };

  const existingScans = submission?.scans || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Feuilles de Composition</h1>
              <p className="text-xs text-slate-500">
                {submission?.candidate?.name} - {submission?.exam?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/admin/submissions/${id}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour à la correction
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Info Card */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
              {submission?.candidate?.name?.charAt(0) || "C"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{submission?.candidate?.name}</h2>
              <p className="text-sm text-slate-500">{submission?.candidate?.email}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                <span>Examen: <strong>{submission?.exam?.name}</strong></span>
                <span>•</span>
                <span>Mode: <Badge>{submission?.exam?.part3Mode === "physical" ? "Physique" : "Numérique"}</Badge></span>
              </div>
            </div>
          </div>
        </Card>

        {submission?.exam?.part3Mode !== "physical" ? (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <AlertTitle className="text-blue-800">Mode Numérique</AlertTitle>
            <AlertDescription className="text-blue-700">
              Cet examen est en mode numérique. Le candidat a rédigé sa réponse directement dans l'application.
              Aucun scan n'est nécessaire.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Upload Section */}
            <Card className="p-6 bg-white shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-500" />
                Upload des scans
              </h3>

              <div className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <AlertTitle className="text-amber-800">Instructions</AlertTitle>
                  <AlertDescription className="text-amber-700 text-sm">
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Scannez les feuilles de composition du candidat</li>
                      <li>Format recommandé : PDF ou images (JPG, PNG)</li>
                      <li>Assurez-vous que le texte est lisible</li>
                      <li>Numérisez dans l'ordre des pages</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div>
                  <Label htmlFor="scans" className="text-sm font-semibold text-slate-700">
                    Sélectionner les fichiers
                  </Label>
                  <Input
                    id="scans"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="mt-1.5"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Formats acceptés : JPG, PNG, PDF
                  </p>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">
                      Fichiers sélectionnés ({selectedFiles.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                        >
                          {file.type.startsWith("image/") ? (
                            <Image className="w-5 h-5 text-blue-500" />
                          ) : (
                            <FileText className="w-5 h-5 text-red-500" />
                          )}
                          <span className="text-sm text-slate-700 truncate flex-1">
                            {file.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={selectedFiles.length === 0 || uploadMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-blue-600"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload des scans ({selectedFiles.length})
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Existing Scans */}
            {existingScans.length > 0 && (
              <Card className="p-6 bg-white shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Image className="w-5 h-5 text-blue-500" />
                  Scans existants ({existingScans.length})
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {existingScans.map((scan: any) => (
                    <Card key={scan.id} className="overflow-hidden group">
                      <div className="aspect-video bg-slate-100 relative">
                        {scan.url?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img
                            src={scan.url}
                            alt={`Scan ${scan.pageNumber || ""}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setPreviewUrl(scan.url)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-12 h-12 text-slate-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setPreviewUrl(scan.url)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(scan.url, "_blank")}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteScanMutation.mutate(scan.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            Page {scan.pageNumber || "?"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(scan.uploadedAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Preview Dialog */}
        {previewUrl && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewUrl(null)}
          >
            <div className="relative max-w-5xl w-full">
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-white/20"
                onClick={() => setPreviewUrl(null)}
              >
                <X className="w-6 h-6" />
              </Button>
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
