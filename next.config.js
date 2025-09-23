/** @type {import('next').NextConfig} */
const nextConfig = {
  // (garde ça activé pour nos Server Actions)
  experimental: {
    serverActions: true,
  },

  // ✅ IMPORTANT : ne pas bloquer le build à cause d’ESLint
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;