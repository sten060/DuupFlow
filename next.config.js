/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // sharp and heic-convert have native binaries — don't bundle them into JS,
  // let Node.js require them from node_modules at runtime
  serverExternalPackages: ["sharp", "heic-convert", "libheif-js"],

  // Exclude heavy packages from the serverless function output tracing.
  // This is the main lever to stay under Vercel's 300MB function size limit.
  outputFileTracingExcludes: {
    "*": [
      // FFmpeg binaries — only spawned as a child process, never imported
      "node_modules/@ffmpeg-installer/**",
      "node_modules/fluent-ffmpeg/**",

      // Dev/build-time only — should never end up in a serverless function
      "node_modules/typescript/**",
      "node_modules/@ts-morph/**",
      "node_modules/ts-morph/**",
      "node_modules/@types/**",
      "node_modules/ts-prune/**",
      "node_modules/tailwindcss/**",
      "node_modules/postcss/**",
      "node_modules/autoprefixer/**",
      "node_modules/caniuse-lite/**",
      "node_modules/cross-env/**",

      // sharp platform binaries not used on Vercel (Linux x64 only)
      "node_modules/@img/sharp-darwin-arm64/**",
      "node_modules/@img/sharp-darwin-x64/**",
      "node_modules/@img/sharp-win32-ia32/**",
      "node_modules/@img/sharp-win32-x64/**",
      "node_modules/@img/sharp-linux-arm/**",
      "node_modules/@img/sharp-linux-arm64/**",
      "node_modules/@img/sharp-libvips-darwin-arm64/**",
      "node_modules/@img/sharp-libvips-darwin-x64/**",
      "node_modules/@img/sharp-libvips-linux-arm/**",
      "node_modules/@img/sharp-libvips-linux-arm64/**",
      "node_modules/@img/sharp-libvips-win32-ia32/**",
      "node_modules/@img/sharp-libvips-win32-x64/**",
    ],
  },
};

export default nextConfig;
