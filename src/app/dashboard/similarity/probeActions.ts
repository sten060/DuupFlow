"use server";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { spawn, execSync } from "child_process";
import { getFFmpegBin } from "@/app/dashboard/videos/processVideos";

/**
 * Resolve ffprobe binary. Since @ffmpeg-installer only ships ffmpeg (no ffprobe),
 * we derive the path from the resolved ffmpeg binary's directory, or scan
 * well-known locations used by nixpacks / apt / brew.
 */
async function getFFprobeBin(): Promise<string> {
  const { existsSync } = await import("fs");

  // 1. Derive from the resolved ffmpeg — if ffmpeg was found via PATH or
  //    a well-known path, ffprobe is in the same directory.
  try {
    const ffmpegBin = await getFFmpegBin();
    const dir = path.dirname(ffmpegBin);
    const candidate = path.join(dir, "ffprobe");
    if (existsSync(candidate)) {
      console.log(`[ffprobe] found next to ffmpeg: ${candidate}`);
      return candidate;
    }
  } catch {}

  // 2. PATH lookup
  try {
    const found = execSync("command -v ffprobe", { encoding: "utf8", shell: "/bin/sh" }).trim();
    if (found && existsSync(found)) {
      console.log(`[ffprobe] found via PATH: ${found}`);
      return found;
    }
  } catch {}

  // 3. Well-known paths
  const CANDIDATES = [
    "/usr/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/nix/var/nix/profiles/default/bin/ffprobe",
  ];
  for (const p of CANDIDATES) {
    if (existsSync(p)) {
      console.log(`[ffprobe] found at known path: ${p}`);
      return p;
    }
  }

  // 4. Scan /nix/store for ffprobe (nixpacks installs into a hashed store path)
  try {
    const found = execSync("find /nix/store -maxdepth 3 -name ffprobe -type f 2>/dev/null | head -1", {
      encoding: "utf8",
      shell: "/bin/sh",
      timeout: 3000,
    }).trim();
    if (found && existsSync(found)) {
      console.log(`[ffprobe] found in nix store: ${found}`);
      return found;
    }
  } catch {}

  console.warn("[ffprobe] not found anywhere, falling back to bare 'ffprobe'");
  return "ffprobe";
}

/**
 * Run ffprobe on an uploaded file and return its format metadata as JSON.
 */
export async function probeFile(formData: FormData): Promise<{ format: Record<string, any>; streams?: Record<string, any>[] } | { error: string }> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier reçu." };

  const ext = path.extname(file.name) || ".mp4";
  const tmpPath = path.join(os.tmpdir(), `duup_probe_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  await fs.writeFile(tmpPath, Buffer.from(await file.arrayBuffer()));

  try {
    const probeBin = await getFFprobeBin();

    const result = await new Promise<string>((resolve, reject) => {
      const args = ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", tmpPath];
      const p = spawn(probeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      p.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      p.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      p.on("error", () => reject(new Error(`ffprobe introuvable (tried: ${probeBin})`)));
      p.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `ffprobe exit ${code}`));
      });
      setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffprobe timeout")); }, 10_000);
    });

    try {
      return JSON.parse(result);
    } catch {
      return { error: "Format de réponse invalide" };
    }
  } catch (e: any) {
    return { error: e?.message || "Erreur ffprobe" };
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
