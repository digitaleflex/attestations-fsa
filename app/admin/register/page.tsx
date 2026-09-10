// app/admin/register/page.tsx
// DEPRECATED — L'inscription ouverte est désactivée.
// Redirige vers la page de connexion unifiée /auth.
import { redirect } from "next/navigation";

export default function AdminRegisterPage() {
  redirect("/auth");
}
