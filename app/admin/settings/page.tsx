"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";

export default function SettingsPage() {
  // États
  const [adminName, setAdminName] = useState("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Charger les données existantes
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin").then(r => r.json()),
      fetch("/api/settings").then(r => r.json())
    ]).then(([admin, settings]) => {
      setAdminName(admin?.name || "");
      setInstitution(settings?.institutionName || "");
      setEmail(settings?.replyTo || "");
      setLogo(settings?.logoUrl || null);
    }).catch(() => setError("Erreur lors du chargement des paramètres."))
      .finally(() => setLoading(false));
  }, []);

  // Logo preview
  const handleLogoChange = (e: any) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setLogo(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Enregistrer le nom admin
  const handleSaveAdmin = async (e: any) => {
    e.preventDefault();
    setSavingAdmin(true); setFeedback(""); setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: adminName })
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erreur lors de la modification du nom");
      setFeedback("Nom d’utilisateur modifié avec succès !");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSavingAdmin(false);
    }
  };

  // Enregistrer le mot de passe
  const handleSavePwd = async (e: any) => {
    e.preventDefault();
    setSavingPwd(true); setFeedback(""); setError("");
    if (newPwd !== confirmPwd) {
      setError("La confirmation ne correspond pas."); setSavingPwd(false); return;
    }
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erreur lors du changement de mot de passe");
      setFeedback("Mot de passe modifié avec succès !");
      setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSavingPwd(false);
    }
  };

  // Enregistrer les settings institutionnels
  const handleSaveSettings = async (e: any) => {
    e.preventDefault();
    setSavingSettings(true); setFeedback(""); setError("");
    let logoUrl = logo;
    // Upload du logo si fichier sélectionné
    if (logoFile) {
      // Simuler un upload (à remplacer par un vrai endpoint si besoin)
      // Ici, on stocke le base64 dans la BDD (pas optimal, mais simple pour démo)
      logoUrl = logo;
    }
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionName: institution, logoUrl, replyTo: email })
      });
      if (!res.ok) throw new Error((await res.json()).message || "Erreur lors de la modification des paramètres institutionnels");
      setFeedback("Paramètres institution modifiés avec succès !");
      setLogoFile(null);
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Paramètres</h1>
      {loading ? <div>Chargement…</div> : <>
        {/* Identité admin */}
        <Card className="mb-8 p-8 rounded-2xl shadow-md">
          <h2 className="text-xl font-semibold mb-6">Identité administrateur</h2>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6" onSubmit={handleSaveAdmin}>
            <div className="md:col-span-2">
              <Label htmlFor="adminName">Nom d’utilisateur</Label>
              <Input id="adminName" value={adminName} onChange={e => setAdminName(e.target.value)} required className="input-style" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={savingAdmin}>{savingAdmin ? "Enregistrement…" : "Enregistrer"}</Button>
            </div>
          </form>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-8" onSubmit={handleSavePwd}>
            <div>
              <Label htmlFor="oldPwd">Ancien mot de passe</Label>
              <Input id="oldPwd" type="password" value={oldPwd} onChange={e => setOldPwd(e.target.value)} required className="input-style" autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="newPwd">Nouveau mot de passe</Label>
              <Input id="newPwd" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required className="input-style" autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirmPwd">Confirmer</Label>
              <Input id="confirmPwd" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required className="input-style" autoComplete="new-password" />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={savingPwd}>{savingPwd ? "Changement…" : "Changer le mot de passe"}</Button>
            </div>
          </form>
          {(feedback || error) && <Alert className="mt-4" variant={error ? "destructive" : undefined}><AlertTitle>{feedback || error}</AlertTitle></Alert>}
        </Card>
        {/* Institution */}
        <Card className="p-8 rounded-2xl shadow-md">
          <h2 className="text-xl font-semibold mb-6">Institution</h2>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={handleSaveSettings}>
            <div className="md:col-span-2">
              <Label htmlFor="institution">Nom de l’institution</Label>
              <Input id="institution" value={institution} onChange={e => setInstitution(e.target.value)} required className="input-style" />
            </div>
            <div>
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" type="file" accept="image/*" onChange={handleLogoChange} className="input-style" ref={logoInputRef} />
              {logo && <Image src={logo} alt="Logo institution" width={64} height={64} className="mt-2 h-16 rounded shadow" />}
            </div>
            <div>
              <Label htmlFor="email">Email reply-to</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-style" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={savingSettings}>{savingSettings ? "Enregistrement…" : "Enregistrer"}</Button>
            </div>
          </form>
          {(feedback || error) && <Alert className="mt-4" variant={error ? "destructive" : undefined}><AlertTitle>{feedback || error}</AlertTitle></Alert>}
        </Card>
      </>}
    </div>
  );
} 