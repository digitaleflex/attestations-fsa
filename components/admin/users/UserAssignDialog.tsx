"use client";

import { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";

export interface AdminExamOption {
  id: string;
  title: string;
  name: string;
  status: string;
  scheduledAt?: string | null;
}

export interface UserAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigningUser: User | null;
  exams: AdminExamOption[];
  examsLoading?: boolean;
  assignForm: { examId: string; examScheduledAt: string };
  onExamSelect: (value: string) => void;
  onScheduledChange: (value: string) => void;
  onSave: () => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  saving?: boolean;
  removing?: boolean;
  currentExamLabel?: string | null;
}

export function UserAssignDialog({
  open,
  onOpenChange,
  assigningUser,
  exams,
  examsLoading,
  assignForm,
  onExamSelect,
  onScheduledChange,
  onSave,
  onRemove,
  saving,
  removing,
  currentExamLabel,
}: UserAssignDialogProps) {
  const visibleExams = exams.filter(
    (e) => e.status === "SCHEDULED" || e.status === "PUBLISHED",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Affecter un examen</DialogTitle>
        </DialogHeader>

        {assigningUser && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Candidat :{" "}
              <span className="font-medium text-slate-800">
                {assigningUser.name || assigningUser.email || assigningUser.id}
              </span>
            </p>

            <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Affectation actuelle
              </p>
              {assigningUser.examId ? (
                <>
                  <p className="font-medium text-slate-800">
                    {currentExamLabel}
                  </p>
                  <p className="text-slate-500">
                    {assigningUser.examScheduledAt
                      ? new Date(assigningUser.examScheduledAt).toLocaleString(
                          "fr-FR",
                        )
                      : "Aucun créneau défini"}
                  </p>
                </>
              ) : (
                <p className="text-slate-500 italic">
                  Aucun examen affecté
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="assign-exam">Examen</Label>
              <Select
                value={assignForm.examId}
                onValueChange={onExamSelect}
              >
                <SelectTrigger id="assign-exam" className="mt-1">
                  <SelectValue
                    placeholder={
                      examsLoading
                        ? "Chargement..."
                        : "Sélectionner un examen"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {visibleExams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title || exam.name} (
                      {exam.status === "PUBLISHED" ? "Publié" : "Planifié"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {visibleExams.length === 0 && !examsLoading && (
                <p className="text-xs text-amber-600 mt-1">
                  Aucun examen visible (SCHEDULED / PUBLISHED).
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="assign-scheduled">
                Créneau (date et heure) — optionnel
              </Label>
              <Input
                id="assign-scheduled"
                type="datetime-local"
                value={assignForm.examScheduledAt}
                onChange={(e) => onScheduledChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onRemove}
                disabled={removing || !assigningUser.examId}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                {removing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Retirer l&apos;affectation
              </Button>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
