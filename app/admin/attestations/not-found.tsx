import * as React from "react"
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-5xl font-bold mb-4 text-destructive">404</h1>
      <p className="mb-6 text-lg text-muted-foreground">Attestation introuvable ou page non trouvée.</p>
      <Button asChild>
        <a href="/admin/dashboard">Retour au dashboard</a>
      </Button>
    </div>
  );
} 