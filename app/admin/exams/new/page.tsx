"use client";

import { ExamForm } from "@/components/exams/exam-form";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function CreateExamPage() {
  return (
    <div className="p-6 space-y-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between max-w-4xl mx-auto">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/exams"
            className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Retour aux examens
          </Link>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Créer un Nouvel Examen
          </h1>
          <p className="text-slate-500 font-medium">
            Concevez une épreuve académique structurée et performante.
          </p>
        </div>
      </div>

      <ExamForm />
    </div>
  );
}
