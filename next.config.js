/** @type {import('next').NextConfig} */
// Single source of truth for UTM short URLs lives in src/lib/utm-redirects.ts
// We require() the compiled output via the typescript runtime — but since
// this file is .js and runs at build start, we can't use ES modules. Instead
// we mirror the small amount of helper logic here using a require() that
// works on the TS source via Next's built-in TS compilation? No — easier:
// duplicate the minimal builder logic inline. The TS source is the human
// reference; this file is the runtime consumer.
//
// To avoid duplication, we import the TS module via dynamic require with
// ts-node would be a build dep. Cleaner: rely on the fact that next.config
// runs in Node BEFORE the bundler — we can't import .ts. So we re-declare
// the builder + entries here in a minimal form, and we keep src/lib/utm-
// redirects.ts as the single editing surface (with a comment in each file
// pointing to the other). Both must stay in sync.
//
// In practice the diff stays tiny because the data is just an array; the
// builder logic is 20 lines. Worth the small duplication to avoid a build
// dep (e.g. tsx, esbuild-register) just for this.

// ── Mirror of src/lib/utm-redirects.ts — EDIT BOTH or use only the TS file
// and keep this one in lockstep. ───────────────────────────────────────
const UTM_REDIRECTS = [
  {
    source: "yt",
    destination: "/",
    utm_source: "youtube",
    utm_medium: "video",
  },
  {
    source: "yt/:slug",
    destination: "/",
    utm_source: "youtube",
    utm_medium: "video",
  },
];

function buildDestinationUrl(r) {
  const [path, existingQs] = r.destination.split("?");
  const params = new URLSearchParams(existingQs ?? "");
  params.set("utm_source", r.utm_source);
  if (r.utm_medium)   params.set("utm_medium",   r.utm_medium);
  if (r.utm_campaign) params.set("utm_campaign", r.utm_campaign);
  if (r.utm_content)  params.set("utm_content",  r.utm_content);
  if (r.utm_term)     params.set("utm_term",     r.utm_term);
  let qs = params.toString();
  if (r.source.includes(":slug") && !r.utm_campaign) {
    qs += (qs ? "&" : "") + "utm_campaign=:slug";
  }
  return `${path}?${qs}`;
}

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // 1) Apex → www canonical (must stay FIRST — UTM rules below need
      //    requests to land on the www host already)
      {
        source: "/:path*",
        has: [{ type: "host", value: "duupflow.com" }],
        destination: "https://www.duupflow.com/:path*",
        permanent: true,
      },
      // 1b) Short tracking links — /go/<source>/<medium>[/<campaign>] → www
      //     with utm_* stamped from the path (fully dynamic; params come from
      //     the URL, not a fixed table). Temporary (307) so they're never
      //     cached as a canonical. 3-segment variant first (order-independent
      //     — different segment counts can't overlap — but explicit for clarity).
      {
        source: "/go/:source/:medium/:campaign",
        destination:
          "https://www.duupflow.com/?utm_source=:source&utm_medium=:medium&utm_campaign=:campaign",
        permanent: false,
      },
      {
        source: "/go/:source/:medium",
        destination:
          "https://www.duupflow.com/?utm_source=:source&utm_medium=:medium",
        permanent: false,
      },
      // 2) UTM short URLs — single-source-of-truth lives in
      //    src/lib/utm-redirects.ts; the array above is its build-time mirror.
      ...UTM_REDIRECTS.map((r) => ({
        source: `/${r.source}`,
        destination: buildDestinationUrl(r),
        statusCode: 301, // literal 301 (Next's `permanent: true` would emit 308)
      })),
    ];
  },
  async rewrites() {
    // Découverte OAuth du connecteur MCP (Éditeur IA) : Claude fetch ces URLs
    // racine `.well-known` ; on les mappe sur nos routes API. Variante path-scoped
    // incluse (certains clients probent `/.well-known/...<chemin-ressource>`).
    return [
      { source: "/.well-known/oauth-protected-resource", destination: "/api/ai-editor/oauth/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/ai-editor/oauth/protected-resource" },
      { source: "/.well-known/oauth-authorization-server", destination: "/api/ai-editor/oauth/authorization-server" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/ai-editor/oauth/authorization-server" },
    ];
  },
  async headers() {
    // Every UTM short URL gets X-Robots-Tag: noindex, nofollow so any crawler
    // that does reach one (via an external link) drops it from the index.
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      ...UTM_REDIRECTS.map((r) => ({ source: `/${r.source}`, headers: noindex })),
      // Short tracking links (/go/*) are the same class of URL — keep them out
      // of the index too.
      { source: "/go/:source/:medium/:campaign", headers: noindex },
      { source: "/go/:source/:medium", headers: noindex },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // Enables src/instrumentation.ts — called once at server start to
    // pre-warm the FFmpeg binary before the first user request arrives.
    instrumentationHook: true,
    // Remotion (rendu des captions du Studio) embarque webpack + des binaires
    // (Chrome headless) — il doit rester EXTERNE au bundle Next, chargé en
    // require Node natif, sinon le build des routes /api/studio casse.
    serverComponentsExternalPackages: [
      "@remotion/bundler",
      "@remotion/renderer",
    ],
  },
};

export default nextConfig;
