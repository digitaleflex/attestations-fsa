"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import "@/components/ui/input-style.css";
import { toast } from "sonner";

export default function NewFormationPage() {
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    skills: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Erreur lors de la création de la formation");
      setSuccess(true);
      setForm({ name: "", category: "", description: "", skills: "" });
      toast.success("Formation créée avec succès !");
      setTimeout(() => router.push("/admin/attestations/new"), 1200);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
      toast.error(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="bg-white rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📚</span>
          <h2 className="text-2xl font-semibold">Nouvelle formation</h2>
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
            <AlertDescription>Formation créée avec succès !</AlertDescription>
          </Alert>
        )}
        <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleSubmit} autoComplete="off">
          <div className="md:col-span-2">
            <Label htmlFor="name">Nom de la formation</Label>
            <Input id="name" name="name" value={form.name} onChange={handleChange} required placeholder="Ex : Certificat en aquaculture" className="input-style" />
          </div>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Input id="category" name="category" value={form.category} onChange={handleChange} required placeholder="Ex : Aquaculture" className="input-style" />
          </div>
          <div>
            <Label htmlFor="skills">Compétences (séparées par des virgules)</Label>
            <Input id="skills" name="skills" value={form.skills} onChange={handleChange} placeholder="Ex : Pisciculture, gestion, biologie" className="input-style" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" value={form.description} onChange={handleChange} placeholder="Description de la formation" className="input-style" />
          </div>
          <div className="md:col-span-2 mt-4">
            <Button type="submit" className="w-full md:w-auto px-8 py-2 text-base" disabled={loading}>
              {loading ? "Création..." : "Créer la formation"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
} 