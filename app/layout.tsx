import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import * as React from "react";
import { TopLoader } from "@/components/TopLoader";

const inter = Inter({ subsets: ["latin"] });

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
        <script
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
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <TopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
