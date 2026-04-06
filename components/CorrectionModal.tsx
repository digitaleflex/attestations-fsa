import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

interface CorrectionModalProps {
  field: { field: string, label: string } | null;
  value: string;
  reason: string;
  onValueChange: (v: string) => void;
  onReasonChange: (r: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function CorrectionModal({
  field,
  value,
  reason,
  onValueChange,
  onReasonChange,
  onClose,
  onSubmit,
  isPending
}: CorrectionModalProps) {
  if (!field) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-none animate-in fade-in zoom-in-95 duration-300 bg-white">
        <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Signaler une erreur</h3>
        </div>
        
        <p className="text-sm text-slate-600 leading-relaxed mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
          Vous demandez une correction officielle pour le champ : <br/>
          <strong className="text-blue-700 text-base font-bold">{field.label}</strong>
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-bold ml-1">Nouvelle valeur correcte</Label>
            <Input
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="Saisissez la valeur exacte..."
              className="h-12 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-600 font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-700 font-bold ml-1 text-sm">Justification (optionnel)</Label>
            <Input
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ex: Faute de frappe lors de l'inscription"
              className="h-12 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-600"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-10">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-100" onClick={onClose}>
            ANNULER
          </Button>
          <Button
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-black text-white shadow-lg shadow-blue-600/20"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "ENVOI EN COURS..." : "VALIDER"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
