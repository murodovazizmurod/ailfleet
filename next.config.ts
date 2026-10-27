import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile)
  output: "standalone",
  experimental: {
    serverActions: {
      // Invoice photo / document uploads on service entries
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
