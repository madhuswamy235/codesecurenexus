import { homeForRole } from "@/hooks/useAuth";

/** Only allow relative in-app paths (prevents open-redirect via next=…). */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (/^https?:/i.test(value)) return null;
  return value;
}

/** Reads the ?next= param from the current URL (browser only). Safe on SSR. */
export function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sanitizeNext(new URLSearchParams(window.location.search).get("next"));
  } catch {
    return null;
  }
}

/** Post-login destination, or the user's role-based home page. */
export function resolveDestination(next: string | null | undefined, role: string): string {
  return sanitizeNext(next) || homeForRole(role);
}

/** Current path including query string, used to build a "next" redirect. */
export function currentPathWithQuery(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}
