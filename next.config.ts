import type { NextConfig } from "next";

process.env.TZ = "America/Fortaleza";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
