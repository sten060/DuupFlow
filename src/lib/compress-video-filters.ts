// Video filter chain of the compressor — shared by /api/compress-sse and the
// ffmpeg startup self-test (src/lib/ffmpeg-selftest.ts), so the self-test
// measures EXACTLY what real compressions run.

/** `-vf` filters for one video: optional downscale, then HDR → SDR tone-map. */
export function compressVideoFilters(maxDim: number, is10bitHEVC: boolean): string[] {
  const vf: string[] = [];
  // Downscale FIRST, then tone-map: the HDR chain works in 32-bit float per pixel,
  // so running it on the already-shrunk frame instead of full 4K cut encode time
  // by ~20% on real iPhone 4K HDR clips (11–26%, same output size and look).
  if (maxDim > 0) {
    // Downscale longest side to maxDim, keep aspect, only shrink. -2 keeps even dims.
    vf.push(`scale='if(gt(iw,ih),min(${maxDim},iw),-2)':'if(gt(iw,ih),-2,min(${maxDim},ih))'`);
  }
  // HDR (10-bit HEVC, typically iPhone) → tone-map to SDR so 8-bit H.264 output
  // doesn't look washed out / over-bright. npl=100 + hable is deliberate here:
  // judged closer to the iPhone's own display than the AI editor's npl=203 +
  // mobius on real footage (Sten, 2026-09-25) — don't "align" the two.
  if (is10bitHEVC) {
    vf.push(
      "zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709",
      "tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv", "format=yuv420p",
    );
  }
  return vf;
}
