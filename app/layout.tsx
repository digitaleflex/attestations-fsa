import "./globals.css";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import * as React from "react";

import NextTopLoader from 'nextjs-toploader';

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
        <NextTopLoader 
          color="#16a34a"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #16a34a,0 0 5px #16a34a"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
