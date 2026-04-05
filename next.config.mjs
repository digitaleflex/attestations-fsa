/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16: Turbopack par défaut, on ajoute une config vide pour silencer le warning
  turbopack: {},
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config, { isServer }) => {
    // Configuration de fallback pour le côté client uniquement
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
  async rewrites() {
    return [
      // Suppression de la réécriture redondante
    ];
  },
  experimental: {
    useCache: true,
  }
};

export default nextConfig;