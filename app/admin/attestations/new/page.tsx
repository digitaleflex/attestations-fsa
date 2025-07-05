"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import "@/components/ui/input-style.css";

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
  const [formations, setFormations] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/formations")
      .then((res) => res.json())
      .then((data) => setFormations(Array.isArray(data) ? data.map((f: any) => f.name) : []))
      .catch(() => setFormations([]));
  }, []);
  const router = useRouter();

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
        issuingCompany: "La Ferme Agro Piscicole Cité St André",
        type: "FORMATION",
      });
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8">
      <Card className="bg-white rounded-2xl shadow-lg px-12 py-12 w-full">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-3xl">🧾</span>
          <h2 className="text-3xl font-semibold">Nouvelle attestation</h2>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-6">
            <AlertTitle>Succès</AlertTitle>
            <AlertDescription>Attestation créée avec succès !</AlertDescription>
          </Alert>
        )}
        <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required placeholder="Nom et prénom du bénéficiaire" className="input-style" />
          </div>
          <div>
            <Label htmlFor="birthDate">Date de naissance</Label>
            <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} required className="input-style" />
          </div>
          <div>
            <Label htmlFor="birthPlace">Lieu de naissance</Label>
            <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} required placeholder="Ville, pays..." className="input-style" />
          </div>
          <div>
            <Label htmlFor="type">Type d'attestation</Label>
            <Select value={form.type} onValueChange={(v) => handleSelect("type", v)} required>
              <SelectTrigger id="type" name="type" className="input-style">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {ATTESTATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="formation">Formation</Label>
            <Input
              id="formation"
              name="formation"
              value={form.formation}
              onChange={handleChange}
              required
              placeholder="Nom de la formation"
              className="input-style"
              list="formations-list"
              autoComplete="off"
            />
            <datalist id="formations-list">
              {formations.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="issuingCompany">Société émettrice</Label>
            <Input id="issuingCompany" name="issuingCompany" value={form.issuingCompany} onChange={handleChange} required placeholder="Nom de la société" className="input-style" />
          </div>
          <div>
            <Label htmlFor="startDate">Date de début</Label>
            <Input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} required className="input-style" />
          </div>
          <div>
            <Label htmlFor="endDate">Date de fin</Label>
            <Input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} required className="input-style" />
          </div>
          <div>
            <Label htmlFor="location">Lieu</Label>
            <Input id="location" name="location" value={form.location} onChange={handleChange} required placeholder="Lieu de la formation ou du stage" className="input-style" />
          </div>
          <div>
            <Label htmlFor="instructor">Formateur</Label>
            <Input id="instructor" name="instructor" value={form.instructor} onChange={handleChange} required placeholder="Nom du formateur" className="input-style" />
          </div>
          <div className="md:col-span-2 mt-6">
            <Button type="submit" className="w-full md:w-auto px-10 py-3 text-base" disabled={loading}>
              {loading ? "Création..." : "Créer l'attestation"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
