import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "recharts", "motion"],
  },
};

export default nextConfig;
