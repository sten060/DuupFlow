import "server-only";
import { cookies } from "next/headers";
import en from "./en.json";
import fr from "./fr.json";

// Kept local (not imported from the "use client" context module) so this stays a
// pure server util.
export type Locale = "en" | "fr";

const dicts: Record<Locale, Record<string, unknown>> = { en, fr };

// Mirrors the client getNestedValue: walk a dotted path, return the path itself
// when missing (so a missing key is visible rather than throwing).
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export type ServerT = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Pure translator bound to a locale — mirrors the client `t()`:
 * nested key lookup, English fallback, and `{var}` interpolation.
 */
export function tFor(locale: Locale): ServerT {
  return (key, vars) => {
    let value = getNestedValue(dicts[locale], key);
    if (value === key) value = getNestedValue(dicts.en, key); // fallback to EN
    if (vars) {
      for (const [k, v] of Object.entries(vars)) value = value.replace(`{${k}}`, String(v));
    }
    return value;
  };
}

/** Read the user's chosen locale from the duupflow_lang cookie (default: en). */
export async function getServerLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return store.get("duupflow_lang")?.value === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

/**
 * Resolve the request locale and return a bound translator. Call once near the
 * top of a route handler / server action, then use `t("errors.…")` everywhere.
 */
export async function getServerT(): Promise<ServerT> {
  return tFor(await getServerLocale());
}
