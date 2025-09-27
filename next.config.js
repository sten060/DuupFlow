// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // ← autorise jusqu’à 100 MB
    },
  },
};

module.exports = nextConfig;