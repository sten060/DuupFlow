"use server";

import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import { exiftool } from "exiftool-vendored";
import { execa } from "execa";
import os from "os";

export async function duplicate(formData: FormData) {
  try {
    // Récupération du fichier
    const file = formData.get("file") as File | null;
    if (!file) {
      throw new Error("Aucun fichier reçu.");
    }

    // Bufferiser le fichier
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Répertoire de sortie (ex: /public/out)
    const outDir = path.join(process.cwd(), "public", "out");
    await fs.mkdir(outDir, { recursive: true });

    // Nom unique avec hash
    const hash = crypto.randomBytes(4).toString("hex");
    const outPath = path.join(outDir, `${hash}-${file.name}`);

    // Exemple : traitement simple avec sharp (image) ou juste copie si vidéo
    if (file.type.startsWith("image/")) {
      await sharp(buffer).toFile(outPath);
    } else {
      await fs.writeFile(outPath, buffer);
    }

    // Renvoie du chemin du fichier généré
    return { success: true, path: `/out/${hash}-${file.name}` };

  } catch (err: any) {
    console.error("Erreur duplicate.ts:", err);
    return { success: false, error: err.message };
  }
}