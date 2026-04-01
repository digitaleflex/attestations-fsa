/** @type {import('next').NextConfig} */
const nextConfig = {
  // Désactive complètement Turbopack
  experimental: {
    // Supprime la configuration turbo
  },
  reactStrictMode: true,
  images: {
    domains: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
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
};

export default nextConfig;