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
function notify() {
  // Newest first.
  _snapshot = Array.from(items.values()).sort((a, b) => b.createdAt - a.createdAt);
  for (const fn of listeners) fn();
}

let _seq = 0;

/** Add a notification. Pass a stable `id` to de-duplicate (upsert). */
export function pushNotification(
  n: Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string },
): string {
  const id = n.id ?? `ntf_${Date.now().toString(36)}_${_seq++}`;
  items.set(id, { kind: n.kind, title: n.title, body: n.body, files: n.files, duration: n.duration, id, createdAt: Date.now(), read: false });
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
