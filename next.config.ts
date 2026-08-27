import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Invoice photo / document uploads on service entries
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
