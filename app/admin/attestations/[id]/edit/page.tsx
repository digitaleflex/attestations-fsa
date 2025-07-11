"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import "@/components/ui/input-style.css";
import clsx from "clsx";
import { toast } from "sonner";
import { useQuery } from '@tanstack/react-query';

const ATTESTATION_TYPES = [
  { value: "FORMATION", label: "Formation" },
  { value: "STAGE", label: "Stage" },
  { value: "CERTIFICATION", label: "Certification" },
];

export default function EditAttestationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formations, setFormations] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<any>({});
  const allowedTypes = ["FORMATION", "STAGE", "CERTIFICATION"];

  // Chargement rapide via React Query
  const { data: attData, isLoading: attLoading, error: attError } = useQuery({
    queryKey: ['attestation', id],
    queryFn: async () => {
      const res = await fetch(`/api/attestations/${id}`);
      if (!res.ok) throw new Error('Erreur lors du chargement de l\'attestation');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: formationsData, isLoading: formationsLoading, error: formationsError } = useQuery({
    queryKey: ['formations', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/formations');
      if (!res.ok) throw new Error('Erreur lors du chargement des formations');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => {
    if (attData) {
      setForm({
        fullName: attData.fullName,
        birthDate: attData.birthDate?.slice(0, 10),
        birthPlace: attData.birthPlace,
        formation: attData.formation?.name || "",
        startDate: attData.startDate?.slice(0, 10),
        endDate: attData.endDate?.slice(0, 10),
        location: attData.location,
        instructor: attData.instructor,
        issuingCompany: attData.issuingCompany,
        type: allowedTypes.includes(attData.type) ? attData.type : "FORMATION",
      });
    }
    if (formationsData) {
      setFormations(Array.isArray(formationsData) ? formationsData.map((f: any) => f.name) : []);
    }
    if (attError) setError("Erreur lors du chargement de l'attestation.");
    if (formationsError) setError("Erreur lors du chargement des formations.");
  }, [attData, formationsData, attError, formationsError]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    const newValue = { ...form, [name]: value };
    setForm(newValue);
    const errors = validate(newValue);
    setFieldErrors((prev: any) => {
      const next = { ...prev, [name]: errors[name] };
      if (!errors[name]) delete next[name];
      return next;
    });
  };

  const handleSelect = (name: string, value: string) => {
    const newValue = { ...form, [name]: value };
    setForm(newValue);
    const errors = validate(newValue);
    setFieldErrors((prev: any) => {
      const next = { ...prev, [name]: errors[name] };
      if (!errors[name]) delete next[name];
      return next;
    });
  };

  const validate = (values: any) => {
    const errors: any = {};
    if (!values.fullName) errors.fullName = "Le nom complet est obligatoire.";
    if (!values.birthDate) errors.birthDate = "La date de naissance est obligatoire.";
    if (!values.birthPlace) errors.birthPlace = "Le lieu de naissance est obligatoire.";
    if (!values.formation) errors.formation = "La formation est obligatoire.";
    if (!values.startDate) errors.startDate = "La date de début est obligatoire.";
    if (!values.endDate) errors.endDate = "La date de fin est obligatoire.";
    if (!values.location) errors.location = "Le lieu est obligatoire.";
    if (!values.instructor) errors.instructor = "Le formateur est obligatoire.";
    if (!values.issuingCompany) errors.issuingCompany = "La société émettrice est obligatoire.";
    if (values.startDate && values.endDate && values.startDate > values.endDate) errors.endDate = "La date de fin doit être postérieure à la date de début.";
    if (values.birthDate && values.startDate && values.birthDate > values.startDate) errors.birthDate = "La date de naissance doit précéder la date de début.";
    return errors;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    const errors = validate(form);
    setFieldErrors(errors);
    if (!allowedTypes.includes(form.type)) {
      setFieldErrors((prev: any) => ({ ...prev, type: "Type d'attestation invalide." }));
      setSaving(false);
      return;
    }
    if (Object.keys(errors).length > 0) {
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/attestations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.field && data.message) {
          setFieldErrors((prev: any) => ({ ...prev, [data.field]: data.message }));
        } else {
          setError(data.message || "Erreur lors de la mise à jour de l'attestation");
          toast.error(data.message || "Erreur lors de la mise à jour de l'attestation");
        }
        return;
      }
      setSuccess(true);
      toast.success("Attestation modifiée avec succès !");
      setTimeout(() => router.push(`/admin/attestations/${id}`), 1200);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  if (attLoading || formationsLoading || !form) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>;
  }

  return (
    <div className="w-full mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">✏️</span>
          <h2 className="text-2xl font-semibold">Éditer l'attestation</h2>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4">
            <AlertTitle>Succès</AlertTitle>
            <AlertDescription>Attestation modifiée avec succès !</AlertDescription>
          </Alert>
        )}
        {Object.values(fieldErrors).some(Boolean) && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Veuillez corriger les champs suivants :</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {Object.entries(fieldErrors)
                  .filter(([_, msg]) => !!msg)
                  .map(([field, msg]) => (
                    <li key={field}>
                      <span className="font-semibold capitalize text-red-700">{field.replace(/([A-Z])/g, ' $1').toLowerCase()} :</span> {msg as string}
                    </li>
                  ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required placeholder="Nom et prénom du bénéficiaire" className={clsx("input-style", fieldErrors.fullName && "border-red-500")}/>
            {fieldErrors.fullName && <div className="text-red-500 text-xs mt-1">{fieldErrors.fullName}</div>}
          </div>
          <div>
            <Label htmlFor="birthDate">Date de naissance</Label>
            <Input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={handleChange} required className={clsx("input-style", fieldErrors.birthDate && "border-red-500")}/>
            {fieldErrors.birthDate && <div className="text-red-500 text-xs mt-1">{fieldErrors.birthDate}</div>}
          </div>
          <div>
            <Label htmlFor="birthPlace">Lieu de naissance</Label>
            <Input id="birthPlace" name="birthPlace" value={form.birthPlace} onChange={handleChange} required placeholder="Ville, pays..." className={clsx("input-style", fieldErrors.birthPlace && "border-red-500")}/>
            {fieldErrors.birthPlace && <div className="text-red-500 text-xs mt-1">{fieldErrors.birthPlace}</div>}
          </div>
          <div>
            <Label htmlFor="type">Type d'attestation</Label>
            <Select value={form.type || "FORMATION"} onValueChange={(v) => handleSelect("type", v)} required>
              <SelectTrigger id="type" name="type" className={clsx("input-style", fieldErrors.type && "border-red-500") }>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {ATTESTATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.type && <div className="text-red-500 text-xs mt-1">{fieldErrors.type}</div>}
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
              className={clsx("input-style", fieldErrors.formation && "border-red-500")}
              list="formations-list"
              autoComplete="off"
            />
            <datalist id="formations-list">
              {formations.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {fieldErrors.formation && <div className="text-red-500 text-xs mt-1">{fieldErrors.formation}</div>}
          </div>
          <div>
            <Label htmlFor="issuingCompany">Société émettrice</Label>
            <Input id="issuingCompany" name="issuingCompany" value={form.issuingCompany} onChange={handleChange} required placeholder="Nom de la société" className={clsx("input-style", fieldErrors.issuingCompany && "border-red-500")}/>
            {fieldErrors.issuingCompany && <div className="text-red-500 text-xs mt-1">{fieldErrors.issuingCompany}</div>}
          </div>
          <div>
            <Label htmlFor="startDate">Date de début</Label>
            <Input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} required className={clsx("input-style", fieldErrors.startDate && "border-red-500")}/>
            {fieldErrors.startDate && <div className="text-red-500 text-xs mt-1">{fieldErrors.startDate}</div>}
          </div>
          <div>
            <Label htmlFor="endDate">Date de fin</Label>
            <Input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} required className={clsx("input-style", fieldErrors.endDate && "border-red-500")}/>
            {fieldErrors.endDate && <div className="text-red-500 text-xs mt-1">{fieldErrors.endDate}</div>}
          </div>
          <div>
            <Label htmlFor="location">Lieu</Label>
            <Input id="location" name="location" value={form.location} onChange={handleChange} required placeholder="Lieu de la formation ou du stage" className={clsx("input-style", fieldErrors.location && "border-red-500")}/>
            {fieldErrors.location && <div className="text-red-500 text-xs mt-1">{fieldErrors.location}</div>}
          </div>
          <div>
            <Label htmlFor="instructor">Formateur</Label>
            <Input id="instructor" name="instructor" value={form.instructor} onChange={handleChange} required placeholder="Nom du formateur" className={clsx("input-style", fieldErrors.instructor && "border-red-500")}/>
            {fieldErrors.instructor && <div className="text-red-500 text-xs mt-1">{fieldErrors.instructor}</div>}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" className="px-8 py-2 text-base" disabled={saving || Object.values(fieldErrors).some(Boolean)}>
              {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
} 