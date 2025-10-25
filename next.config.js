/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true, // permet d'importer des modules ESM externes
  },
};

export default nextConfig;