/**
 * UTM short-URL redirects — single source of truth.
 *
 * Each entry creates one 301 redirect at the edge (configured in
 * next.config.js) that stamps GA4 / our internal acquisition tracker with
 * the appropriate utm_* parameters. Short URLs are brand-friendly enough to
 * fit in a YouTube description, an Instagram bio, or a Telegram pinned
 * message without burning characters on tracking params.
 *
 * Two patterns supported per channel:
 *   • Static aggregate  — `source: 'yt'`            → fixed utm_* values
 *   • Dynamic per-asset — `source: 'yt/:slug'`      → slug captured into
 *                                                     utm_campaign
 *
 * To add a new channel, add ONE (or two) entries below. next.config.js,
 * robots.ts and any reserved-slug registry auto-sync from this list.
 *
 * SEO posture:
 *   • next.config.js emits an `X-Robots-Tag: noindex, nofollow` header on
 *     every short URL so crawlers drop them on sight
 *   • robots.ts adds matching `Disallow:` lines so well-behaved bots never
 *     fetch them in the first place
 *   • All redirects are 301 — short URLs are permanently the wrong canonical;
 *     anything indexing must consolidate on the destination
 */

export type UtmRedirect = {
  /** Short slug WITHOUT leading slash. Use `'yt'` (static) or `'yt/:slug'`
   *  (dynamic — Next.js param substitution). */
  source: string;
  /** Destination path WITH leading slash (e.g. `'/'`). Query string is
   *  rebuilt by `buildDestinationUrl` — don't put utm_* here. */
  destination: string;
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

/** Build the destination URL with utm_* params. When `source` ends in
 *  `:slug`, the captured segment becomes `utm_campaign` automatically (unless
 *  the entry sets `utm_campaign` explicitly).
 *
 *  Note: `URLSearchParams.toString()` would URL-encode `:` to `%3A`, which
 *  breaks Next.js param substitution. We append `utm_campaign=:slug` AFTER
 *  the `.toString()` via raw string concatenation to keep the `:slug` token
 *  literal so Next can substitute it server-side.
 */
export function buildDestinationUrl(r: UtmRedirect): string {
  const [path, existingQs] = r.destination.split("?");
  const params = new URLSearchParams(existingQs ?? "");
  params.set("utm_source", r.utm_source);
  if (r.utm_medium)   params.set("utm_medium",   r.utm_medium);
  if (r.utm_campaign) params.set("utm_campaign", r.utm_campaign);
  if (r.utm_content)  params.set("utm_content",  r.utm_content);
  if (r.utm_term)     params.set("utm_term",     r.utm_term);

  let qs = params.toString();

  // Dynamic capture: source like 'yt/:slug' → utm_campaign=:slug, only if
  // the entry didn't already define utm_campaign. Concatenated manually so
  // the `:slug` token survives URL encoding.
  if (r.source.includes(":slug") && !r.utm_campaign) {
    qs += (qs ? "&" : "") + "utm_campaign=:slug";
  }

  return `${path}?${qs}`;
}

export const UTM_REDIRECTS: UtmRedirect[] = [
  // ── YouTube ──────────────────────────────────────────────────────────
  // Aggregate — paste in a channel bio / generic comment when per-video
  // tracking isn't worth the slug
  {
    source: "yt",
    destination: "/",
    utm_source: "youtube",
    utm_medium: "video",
  },
  // Dynamic — captured slug becomes utm_campaign so each video gets its
  // own row in the analytics. Slug is free-form (kebab-case recommended):
  //   /yt/launch-2026     → utm_campaign=launch-2026
  //   /yt/vs-zapier       → utm_campaign=vs-zapier
  {
    source: "yt/:slug",
    destination: "/",
    utm_source: "youtube",
    utm_medium: "video",
  },
];

/** Disallow lines for robots.txt — derives from UTM_REDIRECTS so any new
 *  channel added above auto-syncs to the robots policy. Dynamic patterns get
 *  a trailing slash (e.g. `/yt/`) which Disallows everything under that
 *  prefix; static entries are emitted as-is. */
export const UTM_REDIRECT_DISALLOW: string[] = UTM_REDIRECTS.map((r) => {
  const idx = r.source.indexOf("/:");
  if (idx >= 0) return `/${r.source.slice(0, idx)}/`;
  return `/${r.source}`;
});

/** First-segment slugs reserved by UTM redirects, deduplicated. Use this in
 *  any user-generated slug registry (e.g. RESERVED_SLUGS sets) to prevent
 *  collisions — a user creating a profile/page at /yt would shadow the
 *  redirect. Currently DuupFlow has no public user-generated slug system,
 *  so this helper is exported for future use. */
export const UTM_REDIRECT_SLUGS: string[] = Array.from(
  new Set(
    UTM_REDIRECTS.map((r) => {
      const idx = r.source.indexOf("/");
      return idx >= 0 ? r.source.slice(0, idx) : r.source;
    }),
  ),
);
