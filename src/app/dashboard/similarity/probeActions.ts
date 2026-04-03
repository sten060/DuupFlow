"use server";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { getFFmpegBin } from "@/app/dashboard/videos/processVideos";

/** Map short format names to long names (matches ffprobe output) */
const FORMAT_LONG_NAMES: Record<string, string> = {
  mov: "QuickTime / MOV",
  mp4: "QuickTime / MOV",
  m4a: "QuickTime / MOV",
  "3gp": "QuickTime / MOV",
  "3g2": "QuickTime / MOV",
  mj2: "QuickTime / MOV",
  avi: "AVI (Audio Video Interleaved)",
  mkv: "Matroska / WebM",
  webm: "Matroska / WebM",
  flv: "FLV (Flash Video)",
  ts: "MPEG-TS (MPEG-2 Transport Stream)",
  mpg: "MPEG-PS (MPEG-2 Program Stream)",
  wmv: "ASF (Advanced / Active Streaming Format)",
  ogg: "Ogg",
};

/**
 * Parse `ffmpeg -i <file>` stderr output into a structure matching
 * ffprobe JSON ({format, streams}) so the UI works identically.
 */
function parseFfmpegInfo(stderr: string, fileSize: number): { format: Record<string, any>; streams: Record<string, any>[] } {
  const format: Record<string, any> = {};
  const streams: Record<string, any>[] = [];

  // --- Format name ---
  // Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/tmp/file.mov':
  const fmtMatch = stderr.match(/Input #0,\s*([^,][^:]*?),?\s+from\s+/);
  if (fmtMatch) {
    const rawFormats = fmtMatch[1].trim().replace(/,\s*$/, "");
    format.format_name = rawFormats;
    // Derive long name from first format token
    const first = rawFormats.split(",")[0].trim();
    format.format_long_name = FORMAT_LONG_NAMES[first] || first;
  }

  // --- Duration, start, bitrate ---
  const durMatch = stderr.match(/Duration:\s*([\d:.]+)/);
  if (durMatch) {
    const parts = durMatch[1].split(":");
    const secs = (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2]);
    format.duration = String(secs.toFixed(6));
  }
  const startMatch = stderr.match(/start:\s*([\d.]+)/);
  if (startMatch) format.start_time = startMatch[1];

  const bitrateMatch = stderr.match(/bitrate:\s*([\d]+)\s*kb\/s/);
  if (bitrateMatch) format.bit_rate = String(+bitrateMatch[1] * 1000);

  format.size = String(fileSize);

  // --- Top-level metadata (tags) ---
  // Everything between the first "Metadata:" and "Duration:" line
  // ffmpeg -i output structure:
  //   Input #0, mov,..., from 'file':
  //     Metadata:
  //       key : value
  //       com.apple.quicktime.model: iPhone 15
  //     Duration: ...
  //     Stream #0:0: ...
  const tags: Record<string, string> = {};

  // Find the first Metadata block (container-level, before Duration)
  const metaStart = stderr.indexOf("Metadata:");
  const durationLine = stderr.indexOf("Duration:");
  if (metaStart !== -1 && durationLine !== -1 && metaStart < durationLine) {
    const block = stderr.slice(metaStart + "Metadata:".length, durationLine);
    for (const line of block.split("\n")) {
      // Match: "    key  : value" — key can contain dots, dashes, underscores
      const m = line.match(/^\s+([\w][\w.\s-]*?)\s*:\s*(.+)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim();
        tags[key] = val;
      }
    }
  }
  if (Object.keys(tags).length) format.tags = tags;

  // --- Streams ---
  const streamRegex = /Stream #\d+:\d+(?:\([^)]*\))?:\s*(Video|Audio|Subtitle|Data):\s*(.+)/g;
  let match;
  while ((match = streamRegex.exec(stderr)) !== null) {
    const codecType = match[1].toLowerCase();
    const info = match[2];
    const stream: Record<string, any> = { codec_type: codecType };

    // codec name
    const codecMatch = info.match(/^(\S+)/);
    if (codecMatch) stream.codec_name = codecMatch[1].replace(/,$/, "");

    // profile: h264 (High)
    const profileMatch = info.match(/^\S+\s+\(([^)]+)\)/);
    if (profileMatch) stream.profile = profileMatch[1];

    if (codecType === "video") {
      const resMatch = info.match(/(\d{2,5})x(\d{2,5})/);
      if (resMatch) {
        stream.width = +resMatch[1];
        stream.height = +resMatch[2];
      }
      const pixMatch = info.match(/,\s*(yuv\w+|rgb\w+|bgr\w+|gray\w*|p010\w*|nv\d+)/);
      if (pixMatch) stream.pix_fmt = pixMatch[1];
      const fpsMatch = info.match(/([\d.]+)\s*fps/);
      if (fpsMatch) stream.avg_frame_rate = `${fpsMatch[1]}/1`;
      const vbrMatch = info.match(/([\d]+)\s*kb\/s/);
      if (vbrMatch) stream.bit_rate = String(+vbrMatch[1] * 1000);
      const colorMatch = info.match(/\(tv,\s*(\w+)\)/);
      if (colorMatch) stream.color_space = colorMatch[1];
      // duration from stream-level metadata
      const durStreamMatch = info.match(/Duration:\s*([\d:.]+)/);
      if (durStreamMatch) {
        const p = durStreamMatch[1].split(":");
        stream.duration = String((+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]));
      }
    }

    if (codecType === "audio") {
      const srMatch = info.match(/(\d+)\s*Hz/);
      if (srMatch) stream.sample_rate = srMatch[1];
      const chMatch = info.match(/Hz,\s*(mono|stereo|[\d.]+(?:\s*\(\w+\))?)/);
      if (chMatch) {
        const ch = chMatch[1].split("(")[0].trim();
        stream.channels = ch === "mono" ? 1 : ch === "stereo" ? 2 : +ch || 0;
        stream.channel_layout = ch;
      }
      const abrMatch = info.match(/([\d]+)\s*kb\/s/);
      if (abrMatch) stream.bit_rate = String(+abrMatch[1] * 1000);
    }

    // Stream-level metadata
    const streamIdx = match.index + match[0].length;
    const nextStreamIdx = stderr.indexOf("Stream #", streamIdx);
    const metaSection = stderr.slice(streamIdx, nextStreamIdx > 0 ? nextStreamIdx : undefined);
    const streamMetaMatch = metaSection.match(/Metadata:\s*\n([\s\S]*?)(?=\n\s*(?:Stream|$))/);
    if (streamMetaMatch) {
      const sTags: Record<string, string> = {};
      for (const line of streamMetaMatch[1].split("\n")) {
        const m = line.match(/^\s+([\w][\w.\s-]*?)\s*:\s*(.+)$/);
        if (m) sTags[m[1].trim()] = m[2].trim();
      }
      if (Object.keys(sTags).length) stream.tags = sTags;
    }

    streams.push(stream);
  }

  format.nb_streams = String(streams.length);
  // probe_score: 100 for recognized containers
  format.probe_score = format.format_name ? "100" : "0";

  return { format, streams };
}

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".heic", ".heif", ".avif"]);

/**
 * Probe an image file using sharp — reads EXIF, ICC, and format metadata.
 */
async function probeImage(buf: Buffer, realSize: number, fileName: string): Promise<{ format: Record<string, any>; streams: Record<string, any>[] }> {
  const sharpMod = await import("sharp");
  const sharp = sharpMod.default;
  const meta = await sharp(buf, { failOn: "none" }).metadata();

  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  const format: Record<string, any> = {
    format_name: ext || meta.format || "image",
    format_long_name: meta.format === "jpeg" ? "JPEG (Joint Photographic Experts Group)"
      : meta.format === "png" ? "PNG (Portable Network Graphics)"
      : meta.format === "webp" ? "WebP"
      : meta.format || "Image",
    size: String(realSize),
    nb_streams: "1",
    probe_score: "100",
  };

  // Build tags from EXIF
  const tags: Record<string, string> = {};
  if (meta.exif) {
    try {
      const exifReader = await import("exif-reader");
      const exifParse = exifReader.default || exifReader;
      const exifData = exifParse(meta.exif);

      // Flatten EXIF data into tags
      const flattenExif = (obj: any, prefix = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const [key, val] of Object.entries(obj)) {
          if (val === null || val === undefined) continue;
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (val instanceof Date) {
            tags[fullKey] = val.toISOString();
          } else if (typeof val === "object" && !Array.isArray(val) && !(val instanceof Buffer)) {
            flattenExif(val, fullKey);
          } else if (Array.isArray(val)) {
            tags[fullKey] = val.join(", ");
          } else if (val instanceof Buffer) {
            // skip binary data
          } else {
            tags[fullKey] = String(val);
          }
        }
      };
      if (exifData.Image || exifData.image) flattenExif(exifData.Image || exifData.image, "");
      if (exifData.Photo || exifData.exif) flattenExif(exifData.Photo || exifData.exif, "");
      if (exifData.GPSInfo || exifData.gps) flattenExif(exifData.GPSInfo || exifData.gps, "GPS");
      // Also flatten top-level for simpler exif-reader versions
      if (!exifData.Image && !exifData.image) flattenExif(exifData, "");
    } catch (e) {
      // exif-reader not available or parsing failed — try manual approach
      tags["exif"] = "present (parsing unavailable)";
    }
  }

  // Add basic metadata as tags
  if (meta.density) tags["density_dpi"] = String(meta.density);
  if (meta.chromaSubsampling) tags["chromaSubsampling"] = meta.chromaSubsampling;
  if (meta.isProgressive) tags["progressive"] = "true";
  if (meta.hasProfile) tags["icc_profile"] = "present";
  if (meta.space) tags["colorspace"] = meta.space;

  if (Object.keys(tags).length) format.tags = tags;

  // Stream info
  const stream: Record<string, any> = {
    codec_type: "video",
    codec_name: meta.format || "image",
    width: meta.width,
    height: meta.height,
    pix_fmt: meta.channels === 4 ? "rgba" : meta.channels === 3 ? "rgb" : `channels_${meta.channels}`,
  };
  if (meta.space) stream.color_space = meta.space;

  return { format, streams: [stream] };
}

/**
 * Run ffmpeg -i on a video file and return parsed metadata,
 * or use sharp for images to read EXIF data.
 */
export async function probeFile(formData: FormData): Promise<{ format: Record<string, any>; streams?: Record<string, any>[] } | { error: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier reçu." };

  const realSize = parseInt(formData.get("realSize") as string, 10) || file.size;
  const ext = path.extname(file.name).toLowerCase() || ".mp4";
  const buf = Buffer.from(await file.arrayBuffer());

  // Use sharp for images — ffmpeg -i doesn't read EXIF tags
  if (IMAGE_EXTS.has(ext)) {
    try {
      return await probeImage(buf, realSize, file.name);
    } catch (e: any) {
      return { error: e?.message || "Erreur analyse image" };
    }
  }

  // Video files — use ffmpeg -i
  const tmpPath = path.join(os.tmpdir(), `duup_probe_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  await fs.writeFile(tmpPath, buf);

  try {
    const ffmpegBin = await getFFmpegBin();

    const stderr = await new Promise<string>((resolve, reject) => {
      const p = spawn(ffmpegBin, ["-i", tmpPath, "-hide_banner"], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stderr.on("data", (d: Buffer) => { out += d.toString(); });
      p.on("error", () => reject(new Error(`ffmpeg introuvable (tried: ${ffmpegBin})`)));
      p.on("close", () => resolve(out));
      setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")); }, 10_000);
    });

    return parseFfmpegInfo(stderr, realSize);
  } catch (e: any) {
    return { error: e?.message || "Erreur analyse fichier" };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
