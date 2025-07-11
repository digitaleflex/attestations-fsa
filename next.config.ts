import type { Configuration } from 'webpack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Désactive complètement Turbopack
  experimental: {
    // Supprime la configuration turbo
  },
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config: Configuration, { isServer }) => {
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
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },
    ];
  },
};

export default nextConfig;