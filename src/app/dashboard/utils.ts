// src/app/dashboard/utils.ts
import path from "path";
import fs from "fs/promises";
import { createClient as createSbServer } from "@/lib/supabase/server";

const OUT_BASE = process.env.OUT_BASE || path.join(process.cwd(), "public", "out");

/** 🔐 Récupère le user côté serveur via les cookies Supabase */
async function getCurrentUser() {
  const supabase = createSbServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Not authenticated");
  return user;
}

/** 📁 Crée (si besoin) un dossier unique par utilisateur */
export async function getOutDirForCurrentUser() {
  const user = await getCurrentUser();
  const userDir = path.join(OUT_BASE, user.id);
  await fs.mkdir(userDir, { recursive: true });
  return { dir: userDir, userId: user.id };
}

/** 🧠 Variante utilisable dans les composants server (RSC) */
export async function getOutDirForCurrentUserRSC() {
  return getOutDirForCurrentUser();
}