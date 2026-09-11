// app/api/auth/magic-link/route.ts
// Flux de connexion par lien magique désactivé : plus aucune session non signée.
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(
    new URL(
      "/auth?error=Connexion%20par%20lien%20magique%20d%C3%A9sactiv%C3%A9e",
      request.url,
    ),
  );
}
