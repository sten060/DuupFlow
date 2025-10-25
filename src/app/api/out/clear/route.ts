import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".avi", ".webm"];

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") || "images") as
      | "all"
      | "images"
      | "videos";

    // This is the SAME directory your listOut*/duplicate* functions use
    const { dir } = await getOutDirForCurrentUser();
    await fs.mkdir(dir, { recursive: true });

    const entries = await fs.readdir(dir, { withFileTypes: true });

    const toDelete = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter(
        (n) =>
          !n.startsWith(".") &&
          !n.startsWith("tmp_") &&
          !n.startsWith("__in__") &&
          !n.startsWith("__progress_") &&
          !n.endsWith(".part")
      )
      .filter((n) => {
        if (scope === "images") return IMAGE_EXTS.includes(extOf(n));
        if (scope === "videos") return VIDEO_EXTS.includes(extOf(n));
        return true; // "all"
      });

    await Promise.all(
      toDelete.map((n) =>
        fs.unlink(path.join(dir, n)).catch(() => {})
      )
    );

    return NextResponse.json({ ok: true, deleted: toDelete.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}