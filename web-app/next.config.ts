import type { NextConfig } from "next";

// cacheComponents is off: every page here is per-user (session or private link),
// so there is nothing useful to prerender.
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pg",
    "heic-convert",
    "archiver",
    "nodemailer",
    "bcryptjs",
  ],
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
