import type { NextConfig } from "next";

// Storage host of whichever Supabase project this build points at (dev or production).
const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost").hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
