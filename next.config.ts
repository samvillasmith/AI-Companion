import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "res.cloudinary.com",
      "cloudinary.com"  // Sometimes URLs come from this domain too
    ]
  }
};

export default nextConfig;
