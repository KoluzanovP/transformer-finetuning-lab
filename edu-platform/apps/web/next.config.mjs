/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// Внутренний адрес API-сервиса (в compose — по имени сервиса). Веб проксирует
// на него /api и /uploads, поэтому фронт и API живут на одном публичном домене.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://api:4000";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@edu/shared"],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${API_INTERNAL_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
