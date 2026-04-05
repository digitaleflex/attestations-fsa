"use client";
import * as React from "react";
import { useState } from "react";

export default function VerifierQrPage() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 animate-fade-in-up">
      <h1 className="text-3xl font-bold mb-4 text-green-700 flex items-center gap-2">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 2L2 9m0 0v6a2 2 0 002 2h6m-8-8h6a2 2 0 012 2v6m0-8v6a2 2 0 002 2h6m-8-8h6a2 2 0 012 2v6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
        Vérification par scan QR
      </h1>
      <p className="mb-6 text-center max-w-md text-gray-700">
        La fonctionnalité de scan QR code est temporairement désactivée.<br />
        Merci de vérifier votre attestation via le code unique ou de réessayer plus tard.
      </p>
      <a href="/" className="mt-8 text-blue-700 hover:underline">Retour à l'accueil</a>
    </div>
  );
}
