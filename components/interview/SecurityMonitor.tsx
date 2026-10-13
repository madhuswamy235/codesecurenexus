"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

type ActivityEvent = {
  id: string;
  eventType: string;
  severity: string;
  timestamp: string;
};

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SecurityMonitor({
  interviewId,
  room,
  enabled = true,
}: {
  interviewId?: string;
  room: InterviewRoomController;
  user?: { _id?: string; name?: string; role?: string } | null;
  enabled?: boolean;
}) {
  const lastEventRef = useRef<Record<string, number>>({});
  const fullscreenActiveRef = useRef(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenStatus, setFullscreenStatus] = useState("Not used");
  const [recentEvents, setRecentEvents] = useState<ActivityEvent[]>([]);
  const monitorReady = enabled && Boolean(room.session) && String(room.timer?.status || room.session?.status || "").toLowerCase() === "active";
  const sessionId = room.session?._id || room.session?.id || null;
  const summary = room.securitySummary as Record<string, unknown> | null;
  const reportedTabSwitchCount = typeof summary?.tabSwitchCount === "number"
    ? summary.tabSwitchCount
    : tabSwitchCount;
  const securityWarnings = room.liveSecurity.filter((event) => ["SUSPICIOUS_ACTIVITY", "UNEXPECTED_PARTICIPANT"].includes(event.eventType));
  const recordSecurityEvent = room.recordSecurityEvent;

  const recordEvent = useCallback(async (eventType: "TAB_SWITCH" | "TAB_RETURN" | "WINDOW_BLUR" | "WINDOW_FOCUS" | "FULLSCREEN_EXIT", severity: "LOW" | "MEDIUM" | "HIGH") => {
    const now = Date.now();
    if (now - (lastEventRef.current[eventType] || 0) < 2200) return;
    lastEventRef.current[eventType] = now;
    const item = { id: `${eventType}-${now}`, eventType, severity, timestamp: new Date(now).toISOString() };
    setRecentEvents((previous) => [item, ...previous].slice(0, 8));
    if (!interviewId && !sessionId) return;
    try {
      await recordSecurityEvent(eventType, severity, { source: "browser" });
    } catch {
      // Keep the local timeline visible if the backend is temporarily unavailable.
    }
  }, [interviewId, recordSecurityEvent, sessionId]);

  useEffect(() => {
    if (!monitorReady) return;
    let visible = document.visibilityState === "visible";
    const handleVisibility = () => {
      const nextVisible = document.visibilityState === "visible";
      if (nextVisible !== visible) {
        if (!nextVisible) setTabSwitchCount((count) => count + 1);
        void recordEvent(nextVisible ? "TAB_RETURN" : "TAB_SWITCH", nextVisible ? "LOW" : "HIGH");
      }
      visible = nextVisible;
    };
    const handleBlur = () => void recordEvent("WINDOW_BLUR", "MEDIUM");
    const handleFocus = () => void recordEvent("WINDOW_FOCUS", "LOW");
    const handleFullscreen = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreenStatus(active ? "Active" : "Exited");
      if (active) fullscreenActiveRef.current = true;
      else if (fullscreenActiveRef.current) {
        fullscreenActiveRef.current = false;
        void recordEvent("FULLSCREEN_EXIT", "MEDIUM");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreen);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [monitorReady, recordEvent]);

  if (!monitorReady) {
    return <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200"><h3 className="text-xl font-bold text-cyan-400">Browser activity monitor</h3><p className="mt-3 text-sm text-slate-300">Activity events are recorded while an interview session is active.</p></div>;
  }


  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-slate-900 p-5 text-white shadow-lg">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Browser activity</p><h3 className="text-2xl font-bold text-cyan-300">Interview Integrity Monitor</h3></div><span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">Browser-only</span></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-800 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Recorded tab switches</p><p className="mt-2 text-4xl font-bold text-amber-300">{reportedTabSwitchCount}</p><p className="mt-2 text-xs text-slate-400">Visibility changes are imperfect browser signals.</p></div>
        <div className="rounded-xl bg-slate-800 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Fullscreen</p><p className="mt-2 text-lg font-semibold text-cyan-300">{fullscreenStatus}</p><p className="mt-2 text-xs text-slate-400">Fullscreen is optional and browser reporting is best-effort.</p></div>
      </div>
      {securityWarnings.length > 0 && (
        <div role="status" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          {securityWarnings[0].eventType === "UNEXPECTED_PARTICIPANT"
            ? "An additional participant joined. Verify that everyone in the room is expected."
            : "Repeated tab switching was observed. Please review the session context; browser signals can have benign causes."}
        </div>
      )}
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-800 p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Recent browser events</p><div className="mt-3 space-y-2 text-xs text-slate-200">{recentEvents.length === 0 ? <p className="text-slate-400">No browser activity events yet.</p> : recentEvents.map((event) => <div key={event.id} className="flex items-center justify-between rounded-lg bg-slate-900/70 p-2"><span className="font-medium text-cyan-300">{event.eventType.replace(/_/g, " ")}</span><span className="text-slate-400">{formatClock(event.timestamp)}</span></div>)}</div></div>
      <p className="mt-4 text-xs text-slate-500">Face counting is optional, local to the candidate browser, and does not identify people or analyze gaze/eye contact. Browser signals are imperfect and are not evidence of misconduct.</p>
    </div>
  );
}
