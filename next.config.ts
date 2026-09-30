import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/genai", "@fal-ai/client"],
};

export default nextConfig;
