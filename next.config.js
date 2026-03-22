/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.duupflow.com" }],
        destination: "https://duupflow.com/:path*",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // Enables src/instrumentation.ts — called once at server start to
    // pre-warm the FFmpeg binary before the first user request arrives.
    instrumentationHook: true,
  },
};

export default nextConfig;
