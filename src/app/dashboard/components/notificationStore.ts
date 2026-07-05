/**
 * Module-level notification store (mirrors the jobStore pattern).
 * Holds the discrete notifications shown in the bell: duplication done / failed,
 * generic toasts, etc. LIVE duplication progress is NOT here — that stays on the
 * page (see GlobalVideoProgress + the inline form bar).
 */
export type NotifKind = "info" | "success" | "error";

export type AppNotification = {
  id: string;
  kind: NotifKind;
  title: string;
  body?: string;
  files?: { name: string; url: string }[]; // optional downloadable results
  href?: string; // optional click-through link (e.g. the TikTok launch reminder)
  // If set, the notification auto-dismisses after this many ms (transient, e.g.
  // the "you can leave the page" reassurance). If unset, it persists in the
  // panel until manually dismissed (e.g. a finished-with-downloads result).
  duration?: number;
  createdAt: number;
  read: boolean;
};

const items = new Map<string, AppNotification>();
const listeners = new Set<() => void>();

let _snapshot: AppNotification[] = [];

// Timestamp of this page load — lets us tell freshly-pushed notifications (which
// pop as toasts) apart from ones restored from a previous session (which only
// sit in the panel, so they don't re-pop on every reload).
export const SESSION_START = typeof window !== "undefined" ? Date.now() : 0;

// Notifications are scoped per signed-in user (`duup_notifications:<uid>`) so a
// different account on the same browser never inherits another user's
// notifications. The store is bound to a user via bindNotificationsUser() on
// dashboard mount and unbound (null) on logout.
const STORAGE_PREFIX = "duup_notifications";
// Pre-scoping key — a single global bucket shared across every account on the
// browser. Removed on bind so its leaked contents never resurface.
const LEGACY_GLOBAL_KEY = "duup_notifications";
let currentUserId: string | null = null;

function storageKey(): string | null {
  return currentUserId ? `${STORAGE_PREFIX}:${currentUserId}` : null;
}

function persist() {
  if (typeof window === "undefined") return;
  const key = storageKey();
  if (!key) return; // no user bound yet → never write to a shared key
  try {
    // Only persistent (no-duration) notifications survive a reload — transient
    // toasts (the reassurance, etc.) are meant to vanish on their own.
    const keep = Array.from(items.values()).filter((n) => !n.duration);
    localStorage.setItem(key, JSON.stringify(keep));
  } catch {}
}

function notify() {
  // Newest first.
  _snapshot = Array.from(items.values()).sort((a, b) => b.createdAt - a.createdAt);
  persist();
  for (const fn of listeners) fn();
}

// Notifications are restored per-user via bindNotificationsUser() (called on
// dashboard mount), NOT at module load — loading here used a global key and
// leaked one account's notifications to the next account on the same browser.

let _seq = 0;

/** Add a notification. Pass a stable `id` to de-duplicate (upsert). */
export function pushNotification(
  n: Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string },
): string {
  const id = n.id ?? `ntf_${Date.now().toString(36)}_${_seq++}`;
  items.set(id, { kind: n.kind, title: n.title, body: n.body, files: n.files, href: n.href, duration: n.duration, id, createdAt: Date.now(), read: false });
  notify();
  // Transient notifications remove themselves from the panel after their duration.
  if (n.duration && n.duration > 0) {
    setTimeout(() => dismissNotification(id), n.duration);
  }
  return id;
}

export function dismissNotification(id: string): void {
  if (items.delete(id)) notify();
}

export function clearNotifications(): void {
  if (items.size === 0) return;
  items.clear();
  notify();
}

/**
 * Scope the store to a signed-in user. Loads that user's persisted
 * notifications and routes future writes to their per-user key. Pass null on
 * logout to empty the panel. No-op when already bound to the same user.
 */
export function bindNotificationsUser(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId === currentUserId) return;
  currentUserId = userId;
  // Drop whatever is in memory (belongs to the previous user / pre-bind state).
  items.clear();
  // One-time cleanup of the old unscoped bucket — the cross-account leak source.
  try { localStorage.removeItem(LEGACY_GLOBAL_KEY); } catch {}
  const key = storageKey();
  if (key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved)) {
        for (const n of saved) if (n && typeof n.id === "string") items.set(n.id, n);
      }
    } catch {}
  }
  notify();
}

export function markAllNotificationsRead(): void {
  let changed = false;
  for (const n of items.values()) if (!n.read) { n.read = true; changed = true; }
  if (changed) notify();
}

export function subscribeNotifications(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notificationsSnapshot(): AppNotification[] {
  return _snapshot;
}
