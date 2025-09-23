/** @type {import('next').NextConfig} */
const nextConfig = {
  // Active les Server Actions + augmente la limite d'upload (images/vidéos)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // augmente si besoin
    },
  },

  // IMPORTANT pour Turbopack / RSC : ces paquets restent externes côté serveur
  serverExternalPackages: [
    'fluent-ffmpeg',
    'ffmpeg-static',
    '@ffprobe-installer/ffprobe',
  ],
};

module.exports = nextConfig;
