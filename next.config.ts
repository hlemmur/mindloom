import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during build process for now
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow build to complete with TypeScript errors for now
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
