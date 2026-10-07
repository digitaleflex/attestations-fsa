/** Entrées ignorées : on refuse tout ce qui ressemble à une IP littérale. */
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Nom d'hôte : labels alphanumériques séparés par des points (point final optionnel). */
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/**
 * Normalise une entrée d'allowlist en nom d'hôte « nu », ou `null` si l'entrée
 * est inexploitable. Accepte `cdn.example.com`, `https://cdn.example.com/x`, et
 * (uniquement pour la liste « insécure » de développement) `http://minio:9000`
 * ou `minio:9000` — le port est volontairement ignoré : l'entrée reste
 * destructive de nommer un hôte, pas d'ouvrir un port.
 */
function normalizeRemoteImageHost(entry, { insecure = false } = {}) {
  const raw = String(entry ?? "").trim();
  if (!raw) return null;

  let host = raw;

  if (raw.includes("://")) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    // HTTPS obligatoire, sauf liste « insécure » de développement.
    if (url.protocol !== "https:" && !(insecure && url.protocol === "http:")) return null;
    host = url.hostname;
  }

  host = host.split("/")[0].trim().toLowerCase();
  // Retire un éventuel port résiduel (`minio:9000`).
  if (!host.startsWith("[")) host = host.split(":")[0];
  if (!host) return null;

  // IP littérale (v4 ou v6 entre crochets) : jamais dans une allowlist d'hôtes,
  // c'est précisément la cible du SSRF metadata (169.254.169.254) qu'on bloque.
  if (IPV4.test(host) || host.startsWith("[")) return null;
  // Un caractère joker resterait un trou : l'allowlist est littérale.
  if (/[*?[\]]/.test(host)) return null;
  if (!HOSTNAME.test(host)) return null;

  return host;
}

/** Construit les `remotePatterns` : HTTPS par défaut, HTTP opt-in explicite. */
export function buildImageRemotePatterns(env = process.env) {
  const declared = [
    // Le domaine de l'application elle-même (logo/avatar servis par l'app).
    ...String(env.NEXT_PUBLIC_APP_URL ?? "").split(","),
    // Le bucket public de stockage est la première source légitime d'images.
    ...String(env.S3_PUBLIC_BASE_URL ?? "").split(","),
    ...String(env.NEXT_IMAGE_REMOTE_HOSTS ?? "").split(","),
  ];

  const insecure = String(env.NEXT_IMAGE_REMOTE_HOSTS_INSECURE ?? "").split(",");

  const secureHosts = new Set();
  const insecureHosts = new Set();

  for (const entry of declared) {
    const host = normalizeRemoteImageHost(entry);
    if (host) secureHosts.add(host);
  }
  for (const entry of insecure) {
    // Un hôte « insécurisé » reste nommé explicitement, jamais un joker.
    const host = normalizeRemoteImageHost(entry, { insecure: true });
    if (host) insecureHosts.add(host);
  }

  return [
    ...[...secureHosts].sort().map((hostname) => ({ protocol: "https", hostname })),
    ...[...insecureHosts]
      .filter((hostname) => !secureHosts.has(hostname))
      .sort()
      .map((hostname) => ({ protocol: "http", hostname })),
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // #139 — les tests E2E démarrent leur propre `next dev` sur un port dédié.
  // Next verrouille `<distDir>/dev/lock` : sans distDir séparé, un second
  // serveur de dev refuse de démarrer tant que celui de l'utilisateur tourne.
  // Défaut inchangé (`.next`) hors E2E.
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
    // #284 — allowlist d'hôtes, HTTPS uniquement (voir `buildImageRemotePatterns`).
    remotePatterns: buildImageRemotePatterns(),
  },
  // Exclude global-error from static generation
  // This page is rendered dynamically at runtime only
  staticPageGenerationTimeout: 120,

  // #142 A1 — En-têtes de sécurité (CSP/HSTS/X-Frame réellement implémentés).
  // CSP pragmatique : autorise les besoins Next.js (inline/eval).
  // frame-ancestors 'none' bloque le clickjacking.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // CSP est gérée dynamiquement dans proxy.ts (#290) avec nonce par requête.
          // Les en-têtes statiques restent ici.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
