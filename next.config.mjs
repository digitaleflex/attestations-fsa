/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Exclude global-error from static generation
  // This page is rendered dynamically at runtime only
  staticPageGenerationTimeout: 120,
};

export default nextConfig;
