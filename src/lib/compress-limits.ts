// Batch limits of the dashboard compressor — shared by the client (live gauge,
// refusal on drop) and the server (/api/compress-sse re-checks them, so a
// scripted call can't bypass the UI).
export const COMPRESS_MAX_FILES = 30;
export const COMPRESS_MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

/** "3,1 Go" (fr) / "3.1 GB" (en) — 1024-based, like the OS file size. */
export function formatBytes(n: number | undefined, locale: string): string {
  const fr = locale === "fr";
  const u = fr ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  if (!n || n <= 0) return `0 ${u[2]}`;
  let i = 1;
  let v = n / 1024;
  while (v >= 1024 && i < 3) { v /= 1024; i++; }
  const s = (i >= 2 ? v.toFixed(1) : v.toFixed(0)).replace(/\.0$/, "");
  return `${fr ? s.replace(".", ",") : s} ${u[i]}`;
}
