"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import "@/components/ui/input-style.css";
import clsx from "clsx";

export default function EditFormationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<any>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/formations/${id}`)
      .then(res => res.json())
      .then((formation) => {
        setForm({
          name: formation.name,
          category: formation.category,
          description: formation.description,
          skills: Array.isArray(formation.skills) ? formation.skills.join(", ") : "",
        });
      })
      .catch(() => setError("Erreur lors du chargement de la formation."))
      .finally(() => setLoading(false));
  }, [id]);

  const validate = (values: any) => {
    const errors: any = {};
    if (!values.name) errors.name = "Le nom est obligatoire.";
    if (!values.category) errors.category = "La catégorie est obligatoire.";
    // description optionnelle
    // skills optionnel
    return errors;
  };

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

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/formations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          skills: form.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Erreur lors de la mise à jour de la formation");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(`/admin/formations/${id}`), 1200);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="animate-spin w-8 h-8 text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">✏️</span>
          <h2 className="text-2xl font-semibold">Éditer la formation</h2>
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
            <AlertDescription>Formation modifiée avec succès !</AlertDescription>
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
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="Nom de la formation" className={clsx("input-style", fieldErrors.name && "border-red-500")}/>
            {fieldErrors.name && <div className="text-red-500 text-xs mt-1">{fieldErrors.name}</div>}
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Input id="category" name="category" value={form.category} onChange={handleChange} required placeholder="Catégorie" className={clsx("input-style", fieldErrors.category && "border-red-500")}/>
            {fieldErrors.category && <div className="text-red-500 text-xs mt-1">{fieldErrors.category}</div>}
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" value={form.description} onChange={handleChange} placeholder="Description de la formation" className="input-style" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="skills">Compétences (séparées par des virgules)</Label>
            <Input id="skills" name="skills" value={form.skills} onChange={handleChange} placeholder="Ex: Gestion, Communication, Leadership" className="input-style" />
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