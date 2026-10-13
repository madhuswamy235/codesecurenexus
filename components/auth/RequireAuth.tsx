"use client";

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * RequireAuth — a small client-side guard for protected routes.
 *
 * Shows a loading state while the auth session is being restored, then
 *   - renders <children> when authenticated, or
 *   - redirects to /login?next=<currentPath> when not authenticated,
 * so the user returns to where they were headed after logging in.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const current =
        pathname +
        (typeof window !== "undefined" ? window.location.search : "");
      router.replace(`/login?next=${encodeURIComponent(current)}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Checking authentication…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null; // the redirect effect above runs next tick

  return <>{children}</>;
}