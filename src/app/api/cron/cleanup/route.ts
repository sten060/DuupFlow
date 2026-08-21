// GET /api/cron/cleanup
// Called by Railway's HTTP cron or any uptime monitor.
// Secured by CRON_SECRET env var — requests must pass
//   Authorization: Bearer <CRON_SECRET>
// Set CRON_SECRET to any long random string in Railway env vars.

import { NextRequest, NextResponse } from "next/server";
import { cleanupOldFiles } from "@/app/dashboard/utils";
import { cleanupOldVariants } from "@/lib/ai-editor/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── REFUS PAR DÉFAUT ────────────────────────────────────────────────────
  // La garde était `if (secret && …)` : quand CRON_SECRET n'était pas défini,
  // la vérification sautait et la route devenait PUBLIQUE. Comme elle accepte
  // `?hours=0`, n'importe qui pouvait effacer les fichiers de TOUS les users.
  // Un secret absent doit fermer la porte, pas l'ouvrir.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!secret) {
    console.error("[cron] CRON_SECRET absent — route refusée (configure la variable d'environnement).");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxAgeHours = Number(req.nextUrl.searchParams.get("hours") ?? "1");
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const deleted = await cleanupOldFiles(maxAgeMs);
  // Variantes de l'Éditeur IA : même rétention que les sorties de duplication.
  // (Réf + matière conservées — seules les variantes rendues expirent.)
  const variantsDeleted = await cleanupOldVariants(maxAgeMs).catch(() => 0);
  console.log(`[cron/cleanup] deleted ${deleted} files + ${variantsDeleted} variants older than ${maxAgeHours}h`);

  return NextResponse.json({ ok: true, deleted, variantsDeleted, maxAgeHours });
}
