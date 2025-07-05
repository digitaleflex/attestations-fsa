import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Analytics } from "@vercel/analytics/next"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
