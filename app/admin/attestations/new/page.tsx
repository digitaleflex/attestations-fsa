"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

const ATTESTATION_TYPES = [
  { value: "FORMATION", label: "Formation" },
  { value: "STAGE", label: "Stage" },
  { value: "CERTIFICATION", label: "Certification" },
];

export default function NewAttestationPage() {
  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    birthPlace: "",
    formation: "",
    startDate: "",
    endDate: "",
    location: "",
    instructor: "",
    issuingCompany: "La Ferme Agro Piscicole Cité St André",
    type: "FORMATION",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Supprimer la logique de chargement des formations
  }, []);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelect = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    setGeneratedCode("");
    try {
      const res = await fetch("/api/attestations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Erreur lors de la création de l'attestation");
      const data = await res.json();
      setSuccess(true);
      setGeneratedCode(data.code || "");
      setForm({
        fullName: "",
        birthDate: "",
        birthPlace: "",
        formation: "",
        startDate: "",
        endDate: "",
        location: "",
        instructor: "",
        issuingCompany: "",
        type: "FORMATION",
      });
      // Ne pas rediriger automatiquement
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card className="bg-white border border-gray-200 shadow-md">
        <CardHeader>
          <CardTitle>Nouvelle attestation</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <>
                <Alert>
                  <AlertTitle>Succès</AlertTitle>
                  <AlertDescription>Attestation créée avec succès !</AlertDescription>
                </Alert>
                {generatedCode && (
                  <div className="mt-4">
                    <Label htmlFor="attestationCode">Code de l'attestation</Label>
                    <div className="flex gap-2 items-center">
                      <Input id="attestationCode" value={generatedCode} readOnly className="font-mono" />
                      <Button type="button" variant="outline" onClick={() => {navigator.clipboard.writeText(generatedCode)}}>Copier</Button>
                    </div>
                  </div>
                )}
              </>
            )}
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required placeholder="Nom et prénom du bénéficiaire" />
            </div>
            <div>
              <Label htmlFor="birthDate">Date de naissance</Label>
              <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="birthPlace">Lieu de naissance</Label>
              <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} required placeholder="Ville, pays..." />
            </div>
            <div>
              <Label htmlFor="formation">Formation</Label>
              <Input id="formation" name="formation" value={form.formation} onChange={handleChange} required placeholder="Nom de la formation" />
            </div>
            <div>
              <Label htmlFor="startDate">Date de début</Label>
              <Input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="endDate">Date de fin</Label>
              <Input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="location">Lieu</Label>
              <Input id="location" name="location" value={form.location} onChange={handleChange} required placeholder="Lieu de la formation ou du stage" />
            </div>
            <div>
              <Label htmlFor="instructor">Formateur</Label>
              <Input id="instructor" name="instructor" value={form.instructor} onChange={handleChange} required placeholder="Nom du formateur" />
            </div>
            <div>
              <Label htmlFor="issuingCompany">Société émettrice</Label>
              <Input id="issuingCompany" name="issuingCompany" value={form.issuingCompany} onChange={handleChange} required placeholder="Nom de la société" />
            </div>
            <div>
              <Label htmlFor="type">Type d'attestation</Label>
              <Select value={form.type} onValueChange={(v) => handleSelect("type", v)} required>
                <SelectTrigger id="type" name="type">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  {ATTESTATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Création..." : "Créer l'attestation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
