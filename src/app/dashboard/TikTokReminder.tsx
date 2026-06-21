"use client";

import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n/context";
import { pushNotification } from "./components/notificationStore";
import { markTikTokReminderSent } from "./actions/onboarding";
import { TIKTOK_DEST } from "./TikTokAnnouncementModal";

const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const GUARD_KEY = "duupflow_tiktok_reminder_done";

/**
 * Fires the TikTok launch reminder into the notification bell EXACTLY once,
 * 12 hours after the user dismissed the launch pop-up.
 *
 * `seenAt` / `reminderSent` come from the server (DB-backed, cross-device). A
 * localStorage guard adds a per-device belt so it can't double-fire while the
 * server write settles. Notifications are client-side, so this naturally fires
 * on the user's next dashboard visit after the 12h mark.
 */
export default function TikTokReminder({
  seenAt,
  reminderSent,
}: {
  seenAt: string | null;
  reminderSent: boolean;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!seenAt || reminderSent) return;
    if (localStorage.getItem(GUARD_KEY) === "1") return;

    const seenMs = Date.parse(seenAt);
    if (!Number.isFinite(seenMs)) return;
    if (Date.now() < seenMs + TWELVE_HOURS) return;

    // 12h elapsed → fire once.
    try { localStorage.setItem(GUARD_KEY, "1"); } catch {}
    pushNotification({
      id: "tiktok-launch-reminder", // stable id → de-duped if it ever re-runs
      kind: "info",
      title: t("dashboard.tiktokAnnounce.notifTitle"),
      body: t("dashboard.tiktokAnnounce.notifBody"),
      href: TIKTOK_DEST,
    });
    markTikTokReminderSent().catch(() => {});
  }, [seenAt, reminderSent, t]);

  return null;
}
