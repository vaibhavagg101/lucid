import type { NextConfig } from "next";

//For local mobile testing only
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.29.5', '172.20.10.8'],
};

export default nextConfig;
