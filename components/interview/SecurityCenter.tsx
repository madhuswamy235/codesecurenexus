"use client";

import { useEffect, useState } from "react";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import SecurityMonitor from "./SecurityMonitor";
import api from "@/lib/api";

type Analysis = {
  integrityScore: number;
  riskLevel: string;
  models: {
    randomForest?: { label?: string; riskScore?: number; riskProbability?: number; treeCount?: number };
  };
};

export default function SecurityCenter() {
  const room = useInterviewRoom();
  const [analysisState, setAnalysisState] = useState<{ interviewId: string; status: "loading" | "ready" | "error"; analysis?: Analysis | null; error?: string } | null>(null);
  const analysisStatus = !room.interviewId ? "ready" : analysisState?.interviewId === room.interviewId ? analysisState.status : "loading";
  const analysis = analysisState?.interviewId === room.interviewId ? analysisState.analysis ?? null : null;
  const analysisError = analysisState?.interviewId === room.interviewId ? analysisState.error ?? "" : "";
  const summary = (room.securitySummary as Record<string, unknown> | null) || {};
  const tabSwitchCount = typeof summary.tabSwitchCount === "number" ? summary.tabSwitchCount : 0;
  const nearbyDeviceCount = typeof summary.nearbyDeviceCount === "number" ? summary.nearbyDeviceCount : 0;
  const multipleFaceIncidentCount = typeof summary.multipleFaceIncidentCount === "number" ? summary.multipleFaceIncidentCount : 0;
  const totalEvents = typeof summary.totalEvents === "number" ? summary.totalEvents : 0;

  useEffect(() => {
    if (!room.interviewId) return;
    let cancelled = false;
    const interviewId = room.interviewId;
    api.post("/ai/security/analyze", {
      features: {
        tabSwitches: tabSwitchCount,
        nearbyDeviceCount,
        eventFrequency: Math.max(0, totalEvents - multipleFaceIncidentCount),
        blurFocusEvents: room.securityEvents.filter((event) => ["WINDOW_BLUR", "WINDOW_FOCUS"].includes(event.eventType)).length,
        fullscreenExits: room.securityEvents.filter((event) => event.eventType === "FULLSCREEN_EXIT").length,
      },
    }).then((response) => {
      if (cancelled) return;
      setAnalysisState({ interviewId, status: "ready", analysis: response.data as Analysis | null });
    }).catch((err: unknown) => {
      if (cancelled) return;
      setAnalysisState({
        interviewId,
        status: "error",
        error: err instanceof Error ? err.message : "Random Forest analysis failed.",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [multipleFaceIncidentCount, nearbyDeviceCount, room.interviewId, room.securityEvents, tabSwitchCount, totalEvents]);

  const randomForest = analysis?.models.randomForest;
  const unavailableText = !room.interviewId ? "No interview session" : analysisStatus === "loading" ? "Analyzing…" : analysisStatus === "error" ? "Unavailable" : "Not available";
  const metrics: Array<[string, string, string]> = [
    ["Tab switches", String(tabSwitchCount), "text-amber-300"],
    ["Nearby BLE reports", String(nearbyDeviceCount), "text-cyan-300"],
    ["Multiple-face review incidents", String(multipleFaceIncidentCount), "text-amber-300"],
    ["Security events", String(totalEvents), "text-slate-200"],
    ["Integrity score", analysis ? `${analysis.integrityScore}/100` : unavailableText, "text-emerald-300"],
  ];

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Integrity center</p><h1 className="mt-2 text-3xl font-bold">Interview Integrity Center</h1><p className="mt-2 text-sm text-slate-400">Browser activity, optional BLE scan reports, and opt-in local multi-face counts. No identity recognition, biometric matching, or gaze analysis is performed.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className={`mt-3 text-2xl font-semibold ${color}`}>{value}</p></div>)}</div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <SecurityMonitor interviewId={room.interviewId || undefined} room={room} user={room.user} />
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Random Forest review</h2>
            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Signal only</span>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-800 py-3"><span className="text-slate-300">Predicted risk</span><span className="text-slate-500">{randomForest?.label ?? unavailableText}</span></div>
            <div className="flex justify-between border-b border-slate-800 py-3"><span className="text-slate-300">Risk score</span><span className="text-slate-500">{randomForest ? `${randomForest.riskScore ?? "n/a"}/100` : unavailableText}</span></div>
            <div className="flex justify-between border-b border-slate-800 py-3"><span className="text-slate-300">Forest size</span><span className="text-slate-500">{randomForest?.treeCount ? `${randomForest.treeCount} trees` : unavailableText}</span></div>
          </div>
          {analysisError && <p role="status" className="mt-3 text-xs text-amber-300">{analysisError}</p>}
          <p className="mt-4 text-xs text-slate-500">Scores are not evidence of misconduct and must not be used as the sole basis for hiring.</p>
        </div>
      </div>
    </div>
  );
}
