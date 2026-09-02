import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { getPlanLimits } from "./plans";

export type UsageType = "images" | "videos" | "ai_signatures";

/**
 * The monthly quota window is anchored on the user's `period_start` (free:
 * first-usage date; paid: last Stripe invoice). Returns the start of the
 * current month-window when at least one monthly anniversary has elapsed since
 * `periodStart` — i.e. the counters are stale and should be reset to 0 — or
 * null when we're still inside the same window.
 */
function rolledPeriodStart(periodStart: Date, now: Date): Date | null {
  if (isNaN(periodStart.getTime())) return null;
  let cur = new Date(periodStart);
  let rolled = false;
  // Advance whole months from the anchor until the next step would pass `now`.
  while (true) {
    const next = new Date(cur);
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() > now.getTime()) break;
    cur = next;
    rolled = true;
  }
  return rolled ? cur : null;
}

export interface UsageCheck {
  allowed: boolean;
  userId: string | null;
  plan: string | null;
  current: number;
  limit: number;
  message?: string;
}

/**
 * Checks whether the current authenticated user is allowed to perform
 * `requestedCount` operations of the given type.
 * - Pro plan → always allowed (unlimited)
 * - Solo plan → check against monthly limits
 * - No plan / unauthenticated → denied
 */
export async function checkUsage(
  type: UsageType,
  requestedCount = 1
): Promise<UsageCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const t = await getServerT();
    return {
      allowed: false,
      userId: null,
      plan: null,
      current: 0,
      limit: 0,
      message: t("errors.quota.notAuthenticated"),
    };
  }

  return checkUsageForUser(user.id, type, requestedCount);
}

/**
 * Résout, pour un user, le plan EFFECTIF (invité → plan de l'hôte, impayé →
 * Free), la limite du type demandé et le compteur courant — en appliquant au
 * passage la remise à zéro mensuelle du plan Free.
 *
 * Extrait de checkUsageForUser() pour que reserveUsage() applique EXACTEMENT
 * les mêmes règles : deux résolutions divergentes, c'est un quota qui se
 * contourne selon le chemin emprunté.
 */
async function resolveQuotaContext(
  userId: string,
  type: UsageType,
): Promise<{ plan: string; limit: number; current: number } | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("plan, has_paid, is_guest, host_user_id, payment_overdue")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  let effectivePlan = profile.plan as string | null;
  let overdue = (profile as { payment_overdue?: boolean }).payment_overdue === true;
  if (profile.is_guest && profile.host_user_id) {
    const { data: hostProfile } = await admin
      .from("profiles")
      .select("plan, payment_overdue")
      .eq("id", profile.host_user_id)
      .single();
    effectivePlan = hostProfile?.plan ?? effectivePlan;
    if ((hostProfile as { payment_overdue?: boolean } | null)?.payment_overdue === true) {
      overdue = true;
    }
  }
  if (!effectivePlan) effectivePlan = profile.has_paid ? "pro" : "free";
  if (overdue) effectivePlan = "free";

  if (effectivePlan === "pro") {
    return { plan: "pro", limit: Infinity, current: 0 };
  }

  const planLimits = getPlanLimits(effectivePlan);
  const limit = planLimits[type === "images" ? "images" : type === "videos" ? "videos" : "ai_signatures"];
  const column = `${type}_count` as const;

  const { data: usage } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count, period_start")
    .eq("user_id", userId)
    .single();

  let current = (usage as any)?.[column] ?? 0;

  // Remise à zéro paresseuse une fois la fenêtre mensuelle passée. Vaut pour
  // TOUS les plans à quota (free, starter, solo) : en facturation mensuelle,
  // invoice.paid ré-ancre period_start chaque mois et cette boucle ne se
  // déclenche jamais ; en facturation ANNUELLE, la facture Stripe n'arrive
  // qu'une fois par an — sans ce roulement local, un abonné annuel resterait
  // bloqué sur ses compteurs du premier mois pendant onze mois.
  if ((usage as any)?.period_start) {
    const newStart = rolledPeriodStart(new Date((usage as any).period_start), new Date());
    if (newStart) {
      current = 0;
      await admin
        .from("usage_tracking")
        .update({
          images_count: 0,
          videos_count: 0,
          ai_signatures_count: 0,
          period_start: newStart.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  return { plan: effectivePlan, limit, current };
}

/**
 * Même contrôle de quota que checkUsage mais avec un userId EXPLICITE (pas de
 * cookie de session). Indispensable pour les chemins authentifiés par Bearer
 * token (API/MCP de l'Éditeur IA) où supabase.auth.getUser() ne renvoie rien.
 */
export async function checkUsageForUser(
  userId: string,
  type: UsageType,
  requestedCount = 1
): Promise<UsageCheck> {
  const t = await getServerT();
  const ctx = await resolveQuotaContext(userId, type);

  if (!ctx) {
    return {
      allowed: false,
      userId,
      plan: null,
      current: 0,
      limit: 0,
      message: t("errors.quota.profileNotFound"),
    };
  }

  // Pro → illimité
  if (!Number.isFinite(ctx.limit)) {
    return { allowed: true, userId, plan: ctx.plan, current: 0, limit: Infinity };
  }

  if (ctx.current + requestedCount > ctx.limit) {
    return {
      allowed: false,
      userId,
      plan: ctx.plan,
      current: ctx.current,
      limit: ctx.limit,
      message: await quotaMessage(type, ctx.plan, ctx.current, ctx.limit),
    };
  }

  return { allowed: true, userId, plan: ctx.plan, current: ctx.current, limit: ctx.limit };
}

/** Message « limite atteinte », identique quel que soit le chemin d'appel. */
async function quotaMessage(type: UsageType, plan: string, current: number, limit: number): Promise<string> {
  const t = await getServerT();
  const labels: Record<UsageType, string> = {
    images: t("errors.quota.labelImages"),
    videos: t("errors.quota.labelVideos"),
    ai_signatures: t("errors.quota.labelAiSignatures"),
  };
  // Free et Starter se voient proposer le palier du dessus (Solo/Pro) ; Solo,
  // lui, n'a plus que Pro — d'où le message « attends le renouvellement ».
  const upgradeHint =
    plan === "solo" ? t("errors.quota.upgradeHintSolo") : t("errors.quota.upgradeHintFree");
  return t("errors.quota.limitReached", { current, limit, label: labels[type], hint: upgradeHint });
}

export interface UsageReservation extends UsageCheck {
  /**
   * true  → la réservation est passée par la fonction SQL atomique : deux
   *         appels concurrents ne peuvent PAS dépasser la limite.
   * false → repli non atomique (migration 055 pas encore appliquée) : le
   *         comportement est celui d'avant, une course reste possible.
   */
  atomic: boolean;
}

/**
 * RÉSERVE `count` unités de quota AVANT de produire quoi que ce soit, en un
 * seul UPDATE conditionnel (cf. migration 055). C'est ce qui remplace le couple
 * « checkUsage au début / incrementUsage à la fin » : entre les deux, il y avait
 * une fenêtre de plusieurs minutes pendant laquelle d'autres jobs passaient le
 * contrôle avec le même compteur.
 *
 * Le surplus non produit (fichier rejeté, copie en échec, arrêt manuel) est
 * rendu ensuite avec releaseUsage() — on ne facture que le livré.
 *
 * ⚠ Ne trace RIEN dans `usage_events` : le journal analytique doit refléter ce
 * qui a été livré, pas ce qui a été réservé. L'appelant écrit la ligne avec
 * logUsageEvent() une fois le job terminé.
 */
export async function reserveUsage(
  userId: string,
  type: UsageType,
  count = 1
): Promise<UsageReservation> {
  const ctx = await resolveQuotaContext(userId, type);
  if (!ctx) {
    const t = await getServerT();
    return { allowed: false, atomic: false, userId, plan: null, current: 0, limit: 0, message: t("errors.quota.profileNotFound") };
  }

  const unlimited = !Number.isFinite(ctx.limit);
  const admin = createAdminClient();
  const rpc = await admin.rpc("consume_usage", {
    p_user_id: userId,
    p_type: type,
    p_amount: count,
    p_limit: unlimited ? -1 : ctx.limit,
  });

  if (!rpc.error) {
    if (rpc.data === null || rpc.data === undefined) {
      // Refus atomique = quota dépassé. On relit le compteur pour le message.
      const fresh = await resolveQuotaContext(userId, type);
      const current = fresh?.current ?? ctx.current;
      return {
        allowed: false,
        atomic: true,
        userId,
        plan: ctx.plan,
        current,
        limit: ctx.limit,
        message: await quotaMessage(type, ctx.plan, current, ctx.limit),
      };
    }
    const newCount = rpc.data as number;
    return { allowed: true, atomic: true, userId, plan: ctx.plan, current: newCount - count, limit: ctx.limit };
  }

  // ── Repli : la fonction SQL n'est pas là (migration pas encore appliquée,
  // cache de schéma PostgREST en retard) ou l'appel a échoué. On refait le
  // contrôle-puis-incrément d'avant : pas de garantie anti-course, mais aucun
  // user légitime n'est bloqué par une migration manquante.
  console.warn("[usage] consume_usage indisponible, repli non atomique:", rpc.error.message);
  if (!unlimited && ctx.current + count > ctx.limit) {
    return {
      allowed: false,
      atomic: false,
      userId,
      plan: ctx.plan,
      current: ctx.current,
      limit: ctx.limit,
      message: await quotaMessage(type, ctx.plan, ctx.current, ctx.limit),
    };
  }
  await bumpUsageCounter(userId, type, count).catch((e) => console.error("[usage] repli increment:", e));
  return { allowed: true, atomic: false, userId, plan: ctx.plan, current: ctx.current, limit: ctx.limit };
}

/**
 * Rend `count` unités réservées mais non produites. Best-effort : un échec de
 * restitution ne doit jamais faire échouer un job qui, lui, a réussi.
 */
export async function releaseUsage(userId: string, type: UsageType, count: number): Promise<void> {
  if (!Number.isFinite(count) || count <= 0) return;
  const admin = createAdminClient();
  const rpc = await admin.rpc("release_usage", { p_user_id: userId, p_type: type, p_amount: count });
  if (!rpc.error) return;

  // Repli non atomique, même logique que reserveUsage().
  console.warn("[usage] release_usage indisponible, repli non atomique:", rpc.error.message);
  const column = `${type}_count` as const;
  const { data: existing } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count")
    .eq("user_id", userId)
    .single();
  if (!existing) return;
  await admin
    .from("usage_tracking")
    .update({
      [column]: Math.max(0, ((existing as any)[column] as number) - count),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/** Map UsageType → usage_events.kind (analytics event log). */
const USAGE_EVENT_KIND: Record<UsageType, string> = {
  images: "image_duplication",
  videos: "video_duplication",
  ai_signatures: "ai_signature",
};

/**
 * Atomically increments the monthly counter AND writes one event row to
 * `usage_events` so analytics views can reconstruct per-action history.
 *
 * Safe to call fire-and-forget. The event insert is best-effort — if it
 * fails (e.g. table missing on an old environment), we log and continue;
 * counter update is the authoritative one for quota enforcement.
 */
export async function incrementUsage(
  userId: string,
  type: UsageType,
  count = 1
): Promise<void> {
  await bumpUsageCounter(userId, type, count);
  await logUsageEvent(userId, type, count);
}

/**
 * Bouge le compteur, SANS écrire d'événement. Repli non atomique (lecture puis
 * écriture) : utilisé seulement quand la fonction SQL de la migration 055 n'est
 * pas disponible.
 */
async function bumpUsageCounter(userId: string, type: UsageType, count: number): Promise<void> {
  const admin = createAdminClient();
  const column = `${type}_count` as const;

  const { data: existing } = await admin
    .from("usage_tracking")
    .select("images_count, videos_count, ai_signatures_count")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await admin
      .from("usage_tracking")
      .update({
        [column]: ((existing as any)[column] as number) + count,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await admin.from("usage_tracking").insert({
      user_id: userId,
      [column]: count,
      period_start: new Date().toISOString(),
    });
  }
}

/**
 * Trace UNE ligne dans `usage_events` (journal analytique, cf. Sten Insights).
 * À appeler avec la quantité RÉELLEMENT produite, une fois le job terminé —
 * pas au moment de la réservation, sinon un job à moitié raté est sur-compté.
 * Best-effort : un échec ici ne doit jamais casser un job qui a réussi.
 */
export async function logUsageEvent(userId: string, type: UsageType, qty: number): Promise<void> {
  if (!Number.isFinite(qty) || qty <= 0) return;
  try {
    const admin = createAdminClient();
    await admin.from("usage_events").insert({
      user_id: userId,
      kind: USAGE_EVENT_KIND[type],
      qty,
      source: "live",
    });
  } catch (err) {
    console.error("[usage] usage_events insert failed:", err);
  }
}

/**
 * Trace UN rendu de l'Éditeur IA (create_variant / update_variant) dans
 * usage_events avec le kind dédié 'ai_editor_render' → permet de compter, par
 * user, combien de vidéos ont été générées AVEC L'ÉDITEUR IA (distinct des
 * duplications vidéo classiques). Best-effort : n'échoue jamais l'appelant.
 * ⚠ Nécessite la migration 053 (kind 'ai_editor_render' ajouté à la contrainte).
 */
export async function logAiEditorRender(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("usage_events").insert({
      user_id: userId,
      kind: "ai_editor_render",
      qty: 1,
      source: "live",
    });
  } catch (err) {
    console.error("[usage] ai_editor_render event insert failed:", err);
  }
}

/**
 * Resets all usage counters for a user (called on invoice renewal).
 */
export async function resetUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("usage_tracking")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await admin.from("usage_tracking").update({
      images_count: 0,
      videos_count: 0,
      ai_signatures_count: 0,
      period_start: now,
      updated_at: now,
    }).eq("user_id", userId);
  }
  // If no row exists yet, nothing to reset
}
