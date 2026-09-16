import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import * as React from "react";
import Script from "next/script";
import { TopLoader } from "@/components/TopLoader";
import { BotIdClient } from "botid/client";

const inter = Inter({ subsets: ["latin"], display: "swap" });

// Force all pages to use dynamic rendering instead of static generation
// This prevents build errors with client components that use React hooks
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "FSA - Plateforme d'Attestations",
  description: "Gestion des attestations de formation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <a href="#contenu-principal" className="skip-link">
          Aller au contenu principal
        </a>
        <BotIdClient protect={[{ path: "/api/exams/*/submit", method: "POST" }]} />
        <Script
          id="sw-cleanup"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
          // Force unregister all service workers to clear old cache issues
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
              for(let registration of registrations) {
                registration.unregister();
                console.log('[SW CLEANUP] Unregistered old service worker');
              }
            });
          }
        `,
          }}
        />
        <TopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
