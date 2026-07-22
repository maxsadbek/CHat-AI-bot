import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: false,

  // Disable image optimization for bot assets
  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // Server-side only packages
  serverExternalPackages: ["grammy", "prisma", "@prisma/client", "@prisma/adapter-pg"],
};

export default nextConfig;
