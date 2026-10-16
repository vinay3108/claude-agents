import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@excalidraw/excalidraw'],
  // Native and dynamic-import-heavy server packages load from node_modules at runtime.
  serverExternalPackages: [
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-ai',
    '@huggingface/transformers',
  ],
};

export default nextConfig;
