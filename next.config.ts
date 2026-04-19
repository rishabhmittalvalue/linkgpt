import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase max duration for API routes that call n8n (long-running workflows)
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
