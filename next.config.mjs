import { withBotId } from "botid/next/config";
// @sentry/nextjs v10 : `withSentryConfig` s'importe depuis le sous-chemin
// `@sentry/nextjs/config` (l'export racine est déprécié et disparaît en v11).
import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer && config.resolve) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  // Exclude global-error from static generation
  // This page is rendered dynamically at runtime only
  staticPageGenerationTimeout: 120,

  // #142 A1 — En-têtes de sécurité (CSP/HSTS/X-Frame réellement implémentés).
  // CSP pragmatique : autorise les besoins Next.js (inline/eval) + BotID
  // (api.vercel.com). frame-ancestors 'none' bloque le clickjacking.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.vercel.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        ],
      },
    ];
  },
};

// #151 — Sentry est 100 % OPTIONNEL.
// - Aucune variable SENTRY_* n'est requise : sans SENTRY_DSN, l'instrumentation
//   runtime (instrumentation.ts) est totalement inerte.
// - Sans SENTRY_AUTH_TOKEN, l'upload des sourcemaps est désactivé : un build de
//   production ne peut donc jamais échouer faute de credentials Sentry.
export default withSentryConfig(withBotId(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  silent: true,
});
