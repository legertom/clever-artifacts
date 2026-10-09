import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-user (auth-gated), so component caching buys nothing here.
  cacheComponents: false,
  // Keep the headless-browser packages out of the bundle; they load native
  // binaries at runtime.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Make sure the serverless Chromium binary ships with the functions that
  // generate screenshots.
  outputFileTracingIncludes: {
    "/api/artifacts/**/*": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/artifacts": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
