import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000"],
  turbopack: {
    root
  }
};

export default nextConfig;
