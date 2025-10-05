import path from "path";
import fs from "fs/promises";

export async function getOutDirForCurrentUser() {
  const dir = path.join(process.cwd(), "public", "out");
  await fs.mkdir(dir, { recursive: true });
  return { dir, userId: "demo" };
}

export async function getOutDirForCurrentUserRSC() {
  const dir = path.join(process.cwd(), "public", "out");
  await fs.mkdir(dir, { recursive: true });
  return { dir, userId: "demo" };
}