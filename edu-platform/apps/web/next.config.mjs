/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@edu/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
