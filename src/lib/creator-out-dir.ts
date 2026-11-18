// src/lib/creator-out-dir.ts
//
// Dossier de sortie d'un créateur (OUT_BASE/<clé>) : là où atterrissent les
// copies dupliquées, qu'elles viennent de la page Duplication, du MCP ou de la
// Duplication IA. Module sans dépendance (importable par les scripts de test,
// contrairement à mcp-duplicate qui charge les quotas).

import os from "os";
import path from "path";

const OUT_BASE = process.env.OUT_BASE
  ?? (process.env.VERCEL ? path.join(os.tmpdir(), "duupflow") : path.join(process.cwd(), "public", "out"));

export function creatorOutDir(storeKey: string): string {
  return path.join(OUT_BASE, storeKey);
}
