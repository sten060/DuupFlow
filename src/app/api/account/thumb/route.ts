// GET /api/account/thumb?u=<url encodée> — proxy de miniature.
// Les CDN Instagram/TikTok bloquent le hotlink cross-origin (l'<img> côté client
// échoue). On récupère l'image côté serveur (headers navigateur) et on la ressert
// same-origin. Anti-SSRF : seuls les hôtes CDN connus sont autorisés.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suffixes d'hôtes autorisés (CDN des plateformes uniquement).
const ALLOWED_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "ibyteimg.com",
  "akamaized.net",
];

function hostAllowed(host: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u");
  if (!raw) return new Response("Paramètre u manquant", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("URL invalide", { status: 400 });
  }
  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) {
    return new Response("Hôte non autorisé", { status: 403 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Referer: target.hostname.includes("tiktok") ? "https://www.tiktok.com/" : "https://www.instagram.com/",
        Accept: "image/*,*/*",
      },
    });
    if (!res.ok || !res.body) return new Response("Miniature indisponible", { status: 502 });

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        // Cache court côté navigateur — les URLs de miniature expirent aussi.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Erreur de récupération", { status: 502 });
  }
}
