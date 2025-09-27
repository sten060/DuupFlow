// src/app/dashboard/utils.ts
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server"; // ✅ le bon import

export const BASE_OUT_DIR = path.join(process.cwd(), "public", "out");

// Version pour les Server Actions (duplication, clear, etc.)
export async function getOutDirForCurrentUser() {
  const supabase = await createClient();           // ✅ factory async
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("Not authenticated");

  const userId = user.id;
  const dir = path.join(BASE_OUT_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return { dir, userId };
}

// Version pour les composants RSC (listages, pages)
export async function getOutDirForCurrentUserRSC() {
  const supabase = await createClient();           // ✅ idem
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error("Not authenticated");

  const userId = user.id;
  const dir = path.join(BASE_OUT_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return { dir, userId };
}

export const randSuffix = () => crypto.randomBytes(2).toString("hex");