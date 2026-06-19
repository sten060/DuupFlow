"use client";

// Tiny localStorage helper to remember a module's last-used form settings, so the
// user doesn't re-pick the same options every visit. Best-effort (never throws).
const PREFIX = "duup_settings_";

export function saveSettings(key: string, data: Record<string, unknown>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {}
}

export function loadSettings<T = Record<string, unknown>>(key: string): T | null {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
