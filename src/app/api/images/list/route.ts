import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getOutDirsForListing } from "@/app/dashboard/utils";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const extOf = (name: string) => {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
};

export async function GET() {
  try {
    const dirs = await getOutDirsForListing();
    const lists = await Promise.all(dirs.map(async ({ dir, userId }) =>
      (await fs.readdir(dir).catch(() => [] as string[]))
        .filter(
          (n) =>
            !n.startsWith(".") &&
            !n.startsWith("tmp_") &&
            !n.startsWith("__in__") &&
            !n.endsWith(".part") &&
            !n.startsWith("__progress_") &&
            IMAGE_EXTS.includes(extOf(n))
        )
        .map((n) => `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`)));
    const images = lists.flat();
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
