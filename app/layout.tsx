import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { PwaInstallButton } from "@/components/pwa-install-button";
import * as React from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FSA - Plateforme d'Attestations",
  description: "Gestion des attestations de formation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <PwaInstallButton />
        </Providers>
      </body>
    </html>
  );
}
