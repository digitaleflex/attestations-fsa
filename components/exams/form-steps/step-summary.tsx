"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Layout, 
  ClipboardCheck, 
  Save, 
  Loader2,
  Laptop2,
  HandMetal
} from "lucide-react";
import { ExamFormData } from "../types";

type Props = {
  formData: ExamFormData;
  saving: boolean;
  onSave: () => void;
};

export function StepSummary({ formData, saving, onSave }: Props) {
  return (
    <div className="space-y-6">
      <div className="border-l-4 border-emerald-500 pl-4 mb-4">
        <h2 className="text-xl font-bold text-slate-800">Prêt à enregistrer ?</h2>
        <p className="text-slate-500 text-sm">Vérifiez les informations avant de finaliser.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 bg-slate-50 border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Layout className="w-4 h-4" /> Détails
          </h3>
          <div className="space-y-2">
            <div className="text-sm flex items-center gap-2"><span className="text-slate-400">Titre:</span> <span className="font-semibold">{formData.title || "Sans titre"}</span></div>
            <div className="text-sm flex items-center gap-2"><span className="text-slate-400">Statut:</span> <Badge variant="outline" className="uppercase text-[10px]">{formData.status === 'SCHEDULED' ? '📅 Programmé' : formData.status === 'PUBLISHED' ? '✅ Publié' : formData.status === 'DRAFT' ? '📝 Brouillon' : '📦 Archivé'}</Badge></div>
            {formData.status === 'SCHEDULED' && formData.scheduledAt && (
              <div className="text-sm text-blue-600 flex items-center gap-2 font-medium">
                <span className="text-blue-400">📅 Programmé le:</span> {new Date(formData.scheduledAt).toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </Card>
        <Card className="p-4 bg-emerald-50/30 border-emerald-100 space-y-4">
          <h3 className="font-bold text-emerald-700 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> Structure
          </h3>
          <div className="space-y-3">
            {formData.parts.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">{p.title}</span>
                <div className="flex gap-2">
                  {p.type === 'CASE_STUDY' && (
                    <Badge variant="outline" className={`px-1 h-5 text-[10px] ${p.mode === 'physical' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                      {p.mode === 'physical' ? <HandMetal className="w-2.5 h-2.5 mr-1" /> : <Laptop2 className="w-2.5 h-2.5 mr-1" />}
                      {p.mode === 'physical' ? 'Papier' : 'Digital'}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-white px-1 h-5 text-[10px]">{p.questions.length} Qs</Badge>
                  <Badge variant="outline" className="bg-white px-1 h-5 text-[10px]">{p.duration} Min</Badge>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none font-bold px-1 h-5 text-[10px]">{p.points} Pts</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="pt-4 flex justify-center">
        <Button onClick={onSave} disabled={saving} size="lg" className="h-14 px-12 gap-3 text-lg font-bold shadow-xl hover:shadow-primary/20 transition-all">
          {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
          Enregistrer l'examen
        </Button>
      </div>
    </div>
  );
}
