import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");

    console.log("[proxy-image] Request received for URL:", imageUrl);

    if (!imageUrl) {
      console.error("[proxy-image] Missing URL parameter");
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // Décoder l'URL si elle est encodée
    const decodedUrl = decodeURIComponent(imageUrl);
    console.log("[proxy-image] Fetching from:", decodedUrl);

    // Fetch l'image depuis Replicate avec timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(decodedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/*,*/*",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log("[proxy-image] Response status:", response.status);
    console.log("[proxy-image] Response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[proxy-image] Fetch failed:", response.status, errorText);
      return new NextResponse(`Failed to fetch image: ${response.statusText}`, {
        status: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[proxy-image] Image size:", buffer.length, "bytes");

    // Retourner l'image avec les bons headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    console.error("[proxy-image] Error:", e.message, e.stack);
    return new NextResponse(JSON.stringify({ error: e?.message || "Error proxying image" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
