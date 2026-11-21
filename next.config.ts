import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/places/search": ["./src/data/overture-bh-places.json.gz"],
  },
};

export default nextConfig;
