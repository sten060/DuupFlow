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
      // 2) UTM short URLs — single-source-of-truth lives in
      //    src/lib/utm-redirects.ts; the array above is its build-time mirror.
      ...UTM_REDIRECTS.map((r) => ({
        source: `/${r.source}`,
        destination: buildDestinationUrl(r),
        statusCode: 301, // literal 301 (Next's `permanent: true` would emit 308)
      })),
    ];
  },
  async headers() {
    // Every UTM short URL gets X-Robots-Tag: noindex, nofollow so any crawler
    // that does reach one (via an external link) drops it from the index.
    return UTM_REDIRECTS.map((r) => ({
      source: `/${r.source}`,
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    }));
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
