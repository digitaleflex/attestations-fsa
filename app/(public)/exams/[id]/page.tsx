import { CandidateExamSession } from "@/components/exams/candidate-exam-session";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TakeExamPage({ params }: { params: { id: string } }) {
  return (
    <div className="w-full min-h-screen bg-slate-50/50 pb-20">
      <div className="w-full max-w-6xl mx-auto px-6 py-6 border-b border-slate-200/60 bg-white/40 sticky top-0 md:bg-transparent md:border-none md:static">
        <Link 
          href="/exams" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors py-2 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
          Quitter l'examen (Retour)
        </Link>
      </div>

      <div className="mt-8">
        <CandidateExamSession examId={params.id} />
      </div>
    </div>
  );
}
