import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import * as React from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FSA - Plateforme d'Attestations",
  description: "Gestion des attestations de formation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
