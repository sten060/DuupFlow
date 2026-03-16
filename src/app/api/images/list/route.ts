import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getOutDirForCurrentUser } from "@/app/dashboard/utils";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const extOf = (name: string) => {
  const p = name.lastIndexOf(".");
  return p >= 0 ? name.slice(p).toLowerCase() : "";
};

export async function GET() {
  try {
    const { dir, userId } = await getOutDirForCurrentUser();
    const names = await fs.readdir(dir);
    const finals = names.filter(
      (n) =>
        !n.startsWith(".") &&
        !n.startsWith("tmp_") &&
        !n.startsWith("__in__") &&
        !n.endsWith(".part") &&
        !n.startsWith("__progress_") &&
        IMAGE_EXTS.includes(extOf(n))
    );
    const images = finals.map(
      (n) => `/api/out/${userId}/${encodeURIComponent(path.basename(n))}`
    );
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
