/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Webpack for production builds to avoid Turbopack prerendering bugs
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
};

export default nextConfig;
