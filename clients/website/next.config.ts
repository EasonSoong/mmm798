import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Wallet adapter / anchor pull in some Node-only modules that we don't use
  // server-side; mark them external so the bundle doesn't try to resolve them.
  webpack: (config) => {
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push("pino-pretty");
    }
    return config;
  },
};

export default nextConfig;
