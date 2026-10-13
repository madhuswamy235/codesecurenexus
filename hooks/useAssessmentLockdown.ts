/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";

/**
 * useAssessmentLockdown â€” SECURE ASSESSMENT LOCKDOWN.

 * While active (enabled + interviewId present) the hook:
 *  - Blocks copy / cut / paste events (and Ctrl/Cmd + C / X / V / A / Y / Z
 *    shortcuts) at the document capture phase. This ONLY happens inside
 *    secure assessment mode â€” the hook is never mounted globally, so normal
 *    application copy/paste keeps working everywhere else.
 *  - Blocks the context menu (prevents copy/paste via right-click) during
 *    active assessment. Again scoped to this hook only.
 *  - Logs real security events to the existing backend pipeline:
 *    POST /api/security/event with eventType TAB_SWITCH (tab hidden) and
 *    WINDOW_BLUR (window loses focus). Throttled so transient focus flips do
 *    not spam the database.
 *
 * The hook returns `active` so the UI can render a lockdown banner.
 */

export function useAssessmentLockdown(opts: { interviewId?: string; enabled?: boolean }) {
  const { interviewId, enabled } = opts;
  const [active, setActive] = useState(Boolean(enabled));
  const throttleRef = useRef<Record<string, number>>({});

  const logEvent = useCallback(
    async (eventType: string, severity: string) => {
      if (!interviewId) return;
      const now = Date.now();
      const last = throttleRef.current[eventType] || 0;
      if (now - last < 8000) return;
      throttleRef.current[eventType] = now;
      try {
        await api.post("/security/event", {
          interviewId,
          eventType,
          severity,
          details: { source: "lockdown-observer", at: new Date().toISOString() },
        });
      } catch {
        /* best-effort â€” connection blips must not crash the assessment */
      }
    },
    [interviewId]
  );

  useEffect(() => {
    if (!enabled || !interviewId) {
      setActive(false);
      return;
    }
    setActive(true);

    /* ---- clipboard / context blocking (capture phase, scoped to this page) ---- */
    const blockClipboard = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (["c", "v", "x", "a", "y", "z"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    let lastTabLog = 0;
    const onVisibility = () => {
      if (document.hidden) {
        const now = Date.now();
        if (now - lastTabLog >  8000) {
          lastTabLog = now;
          void logEvent("TAB_SWITCH", "HIGH");
        }
      }
    };

    let lastBlurLog = 0;
    const onBlur = () => {
      const now = Date.now();
      if (now - lastBlurLog >  8000) {
        lastBlurLog = now;
        void logEvent("WINDOW_BLUR", "MEDIUM");
      }
    };

    const optsCapture = { capture: true } as AddEventListenerOptions;
    document.addEventListener("copy", blockClipboard, optsCapture);
    document.addEventListener("cut", blockClipboard, optsCapture);
    document.addEventListener("paste", blockClipboard, optsCapture);
    document.addEventListener("keydown", onKeyDown, optsCapture);
    document.addEventListener("contextmenu", onContextMenu, optsCapture);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("copy", blockClipboard, optsCapture);
      document.removeEventListener("cut", blockClipboard, optsCapture);
      document.removeEventListener("paste", blockClipboard, optsCapture);
      document.removeEventListener("keydown", onKeyDown, optsCapture);
      document.removeEventListener("contextmenu", onContextMenu, optsCapture);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      setActive(false);
    };
  }, [enabled, interviewId, logEvent]);

  return { active, setActive };
}

export default useAssessmentLockdown;