"use client";

import { useEffect, useState } from "react";
import { ExamForm } from "@/components/exams/exam-form";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EditExamPage() {
  const params = useParams();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/exams/${params?.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) {
          // Transform API response to form data format
          const formData = {
            id: data.id,
            title: data.title || data.name,
            description: data.description || "",
            status: data.status || "DRAFT",
            scheduledAt: data.scheduledAt
              ? new Date(data.scheduledAt).toISOString().slice(0, 16)
              : "",
            formationId: data.formationId,
            parts:
              data.parts?.map((p: any) => ({
                id: p.id,
                title: p.title,
                type: p.type,
                duration: p.duration || 30,
                points: p.points,
                order: p.order,
                enabled: true,
                scenario: p.scenario || p.subject,
                questions:
                  p.questions?.map((q: any) => ({
                    text: q.text,
                    type: q.type,
                    points: q.points,
                    order: q.order,
                    options: q.options?.map((o: any) => ({
                      text: o.text,
                      isCorrect: o.isCorrect,
                      feedback: o.feedback || "",
                    })),
                  })) || [],
              })) || [],
          };
          setExam(formData);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-slate-500 font-medium">Chargement de l'examen...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-rose-500 font-bold">Examen non trouvé</p>
        <Link href="/admin/exams" className="text-primary hover:underline">
          Retour aux examens
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/exams"
            className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Retour aux examens
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">
            Modification de l'Examen
          </h1>
          <p className="text-slate-500 font-medium">
            Optimisez ou mettez à jour votre examen.
          </p>
        </div>
      </div>

      <ExamForm initialData={exam} />
    </div>
  );
}
