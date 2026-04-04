import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import * as React from "react";
import { TopLoader } from "@/components/TopLoader";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "FSA - Plateforme d'Attestations",
  description: "Gestion des attestations de formation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#16a34a" />
        <script dangerouslySetInnerHTML={{ __html: `
          // Force unregister all service workers to clear old cache issues
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(let registration of registrations) {
                registration.unregister();
                console.log('[SW CLEANUP] Unregistered old service worker');
              }
            });
          }
        `}} />
      </head>
      <body className={inter.className}>
        <TopLoader />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
