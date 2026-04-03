import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Signaler une erreur</h3>
        <p className="text-sm text-slate-500 mb-6">
          Vous demandez la correction du champ <strong className="text-slate-700">{field.label}</strong> sur vos documents officiels.
        </p>
        
        <div className="space-y-4">
          <div>
            <Label>Valeur correcte souhaitée</Label>
            <Input 
              value={value} 
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="Entrez la valeur exacte..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>Motif de la demande (optionnel)</Label>
            <Input 
              value={reason} 
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ex: Faute de frappe sur l'acte de naissance"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700" 
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? "Envoi..." : "Envoyer la demande"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
