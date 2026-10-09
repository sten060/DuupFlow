import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { getOutDirsForListing, canDeleteOutputs } from "@/app/dashboard/utils";

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
    // Rôle VA : il produit et télécharge, mais ne supprime rien.
    if (!(await canDeleteOutputs())) {
      return NextResponse.json({ ok: false, error: "Ton rôle (VA) ne permet pas de supprimer." }, { status: 403 });
    }
    // Créateur affiché ; vue admin → tous les créateurs.
    let deleted = 0;
    for (const { dir } of await getOutDirsForListing()) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

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
    deleted += toDelete.length;
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "error" },
      { status: 500 }
    );
  }
}