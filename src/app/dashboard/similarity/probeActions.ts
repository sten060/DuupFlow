"use server";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { getFFmpegBin } from "@/app/dashboard/videos/processVideos";

/**
 * Parse `ffmpeg -i <file>` stderr output into a structure similar to
 * ffprobe JSON ({format, streams}) so the UI keeps working unchanged.
 *
 * We use ffmpeg instead of ffprobe because the Railway nixpacks ffmpeg
 * package does not include ffprobe.
 */
function parseFfmpegInfo(stderr: string, fileSize: number): { format: Record<string, any>; streams: Record<string, any>[] } {
  const format: Record<string, any> = {};
  const streams: Record<string, any>[] = [];

  // --- Format-level ---
  // Duration: 00:01:30.05, start: 0.000000, bitrate: 4567 kb/s
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

  // Input #0, mov,mp4,m4a,3gp, from 'file.mov':
  const fmtMatch = stderr.match(/Input #0,\s*([^,]+)/);
  if (fmtMatch) {
    format.format_name = fmtMatch[1].trim();
    format.format_long_name = fmtMatch[1].trim();
  }

  format.size = String(fileSize);
  format.nb_streams = String(streams.length); // updated below

  // --- Metadata ---
  // Grab top-level metadata block (before first Stream line)
  const metaBlock = stderr.match(/Metadata:\s*\n([\s\S]*?)(?=\n\s*Duration:|$)/);
  if (metaBlock) {
    const tags: Record<string, string> = {};
    for (const line of metaBlock[1].split("\n")) {
      const m = line.match(/^\s+(\w[\w\s-]*?)\s*:\s*(.+)$/);
      if (m) tags[m[1].trim().toLowerCase()] = m[2].trim();
    }
    if (Object.keys(tags).length) format.tags = tags;
  }

  // --- Streams ---
  // Stream #0:0(und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 1920x1080 [SAR 1:1 DAR 16:9], 4296 kb/s, 30 fps, 30 tbr, 600 tbn (default)
  // Stream #0:1(und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)
  const streamRegex = /Stream #\d+:\d+(?:\([^)]*\))?:\s*(Video|Audio|Subtitle|Data):\s*(.+)/g;
  let match;
  while ((match = streamRegex.exec(stderr)) !== null) {
    const codecType = match[1].toLowerCase();
    const info = match[2];
    const stream: Record<string, any> = { codec_type: codecType };

    // codec name: first word before parentheses or comma
    const codecMatch = info.match(/^(\S+)/);
    if (codecMatch) stream.codec_name = codecMatch[1].replace(/,$/, "");

    // profile in parentheses right after codec: h264 (High)
    const profileMatch = info.match(/^\S+\s+\(([^)]+)\)/);
    if (profileMatch) stream.profile = profileMatch[1];

    if (codecType === "video") {
      // resolution: 1920x1080
      const resMatch = info.match(/(\d{2,5})x(\d{2,5})/);
      if (resMatch) {
        stream.width = +resMatch[1];
        stream.height = +resMatch[2];
      }
      // pixel format: yuv420p, yuv420p10le, etc.
      const pixMatch = info.match(/,\s*(yuv\w+|rgb\w+|bgr\w+|gray\w*|p010\w*)/);
      if (pixMatch) stream.pix_fmt = pixMatch[1];
      // fps
      const fpsMatch = info.match(/([\d.]+)\s*fps/);
      if (fpsMatch) stream.avg_frame_rate = `${fpsMatch[1]}/1`;
      // video bitrate
      const vbrMatch = info.match(/([\d]+)\s*kb\/s/);
      if (vbrMatch) stream.bit_rate = String(+vbrMatch[1] * 1000);
      // color info
      const colorMatch = info.match(/\(tv,\s*(\w+)\)/);
      if (colorMatch) stream.color_space = colorMatch[1];
    }

    if (codecType === "audio") {
      // sample rate: 44100 Hz
      const srMatch = info.match(/(\d+)\s*Hz/);
      if (srMatch) stream.sample_rate = srMatch[1];
      // channels: mono, stereo, 5.1, etc.
      const chMatch = info.match(/Hz,\s*(mono|stereo|[\d.]+)/);
      if (chMatch) {
        const ch = chMatch[1];
        stream.channels = ch === "mono" ? 1 : ch === "stereo" ? 2 : +ch || 0;
        stream.channel_layout = ch;
      }
      // audio bitrate
      const abrMatch = info.match(/([\d]+)\s*kb\/s/);
      if (abrMatch) stream.bit_rate = String(+abrMatch[1] * 1000);
    }

    // Stream-level metadata (appears after stream line)
    const streamIdx = match.index + match[0].length;
    const nextStream = stderr.indexOf("Stream #", streamIdx);
    const metaSection = stderr.slice(streamIdx, nextStream > 0 ? nextStream : undefined);
    const metaMatch = metaSection.match(/Metadata:\s*\n([\s\S]*?)(?=\n\s*Stream|$)/);
    if (metaMatch) {
      const tags: Record<string, string> = {};
      for (const line of metaMatch[1].split("\n")) {
        const m = line.match(/^\s+(\w[\w\s-]*?)\s*:\s*(.+)$/);
        if (m) tags[m[1].trim().toLowerCase()] = m[2].trim();
      }
      if (Object.keys(tags).length) stream.tags = tags;
    }

    streams.push(stream);
  }

  format.nb_streams = String(streams.length);

  return { format, streams };
}

/**
 * Run ffmpeg -i on an uploaded file and return parsed metadata.
 */
export async function probeFile(formData: FormData): Promise<{ format: Record<string, any>; streams?: Record<string, any>[] } | { error: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier reçu." };

  const ext = path.extname(file.name) || ".mp4";
  const tmpPath = path.join(os.tmpdir(), `duup_probe_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tmpPath, buf);

  try {
    const ffmpegBin = await getFFmpegBin();
    console.log(`[probe] using ffmpeg: ${ffmpegBin}`);

    const stderr = await new Promise<string>((resolve, reject) => {
      // ffmpeg -i file exits with code 1 when no output is specified — that's expected.
      const p = spawn(ffmpegBin, ["-i", tmpPath, "-hide_banner"], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stderr.on("data", (d: Buffer) => { out += d.toString(); });
      p.on("error", () => reject(new Error(`ffmpeg introuvable (tried: ${ffmpegBin})`)));
      p.on("close", () => resolve(out)); // always resolve — exit code 1 is normal
      setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")); }, 10_000);
    });

    return parseFfmpegInfo(stderr, buf.length);
  } catch (e: any) {
    return { error: e?.message || "Erreur analyse fichier" };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
