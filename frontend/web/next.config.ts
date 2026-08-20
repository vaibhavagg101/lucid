import type { NextConfig } from "next";

//For local mobile testing only
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.29.5'],
};

export default nextConfig;
