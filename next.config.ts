import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google/genai", "@fal-ai/client"],
  agentRules: false,
};

export default nextConfig;
