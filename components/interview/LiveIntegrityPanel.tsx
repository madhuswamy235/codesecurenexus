"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";
import WindowsProximityCompanion from "@/components/interview/WindowsProximityCompanion";

type Analysis = {
  integrityScore: number;
  riskLevel: string;
  training?: { source?: string; sampleCount?: number; warning?: string };
  models: {
    randomForest?: {
      status?: string;
      label?: string;
      riskScore?: number;
      riskProbability?: number;
      treeCount?: number;
    };
    cnn?: {
      status?: string;
      algorithm?: string;
      riskScore?: number;
      riskProbability?: number;
      kernelSizes?: number[];
    };
  };
  validation?: {
    sampleCount?: number;
    accuracy?: number;
    macroPrecision?: number;
    macroRecall?: number;
    macroF1?: number;
    method?: string;
    warning?: string;
  };
  fairness?: { status?: string; reason?: string; nextStep?: string };
};

export default function LiveIntegrityPanel({ room }: { room: InterviewRoomController }) {
  const [analysisResult, setAnalysisResult] = useState<{ interviewId: string; analysis: Analysis } | null>(null);
  const [analysisError, setAnalysisError] = useState<{ interviewId: string; message: string } | null>(null);
  const analysis = analysisResult?.interviewId === room.interviewId ? analysisResult.analysis : null;
  const currentAnalysisError = analysisError?.interviewId === room.interviewId ? analysisError.message : "";
  const summary = room.securitySummary as Record<string, unknown> | null;
  const eventTypes = room.liveSecurity.map((event) => event.eventType);
  const modelEventCount = room.liveSecurity.filter((event) => event.eventType !== "MULTIPLE_FACE_DETECTED").length;
  const tabSwitches = typeof summary?.tabSwitchCount === "number"
    ? summary.tabSwitchCount
    : eventTypes.filter((type) => type === "TAB_SWITCH").length;
  const nearbyDeviceCount = typeof summary?.nearbyDeviceCount === "number"
    ? summary.nearbyDeviceCount
    : 0;
  const blurFocusEvents = eventTypes.filter((type) => ["WINDOW_BLUR", "WINDOW_FOCUS"].includes(type)).length;
  const fullscreenExits = eventTypes.filter((type) => type === "FULLSCREEN_EXIT").length;
  const eventDurationMinutes = Math.floor(Math.max(0, room.timer?.seconds || 0) / 60);

  useEffect(() => {
    if (!room.interviewId) return;
    let cancelled = false;
    const interviewId = room.interviewId;
    api.post<Analysis>("/ai/security/analyze", {
      features: {
        tabSwitches,
        blurFocusEvents,
        fullscreenExits,
        nearbyDeviceCount,
        eventFrequency: modelEventCount,
        eventDuration: eventDurationMinutes,
        sessionInterruptions: blurFocusEvents,
      },
    }).then((response) => {
      if (cancelled) return;
      if (!response.data) {
        setAnalysisError({ interviewId, message: "Random Forest analysis returned no result." });
        return;
      }
      setAnalysisResult({ interviewId, analysis: response.data });
      setAnalysisError(null);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setAnalysisError({
        interviewId,
        message: err instanceof Error ? err.message : "Random Forest analysis failed.",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [blurFocusEvents, eventDurationMinutes, fullscreenExits, modelEventCount, nearbyDeviceCount, room.interviewId, tabSwitches]);

  const score = currentAnalysisError ? undefined : analysis?.integrityScore;
  const risk = currentAnalysisError ? "UNAVAILABLE" : analysis?.riskLevel || (typeof score === "number" ? (score < 70 ? "HIGH" : score < 85 ? "MEDIUM" : "LOW") : "AWAITING");
  const randomForest = currentAnalysisError ? undefined : analysis?.models.randomForest;
  const cnn = currentAnalysisError ? undefined : analysis?.models.cnn;
  const latestReviewEvent = room.liveSecurity.find((event) => [
    "MULTIPLE_FACE_DETECTED",
    "NEARBY_DEVICE_DETECTED",
    "SUSPICIOUS_ACTIVITY",
    "UNEXPECTED_PARTICIPANT",
  ].includes(event.eventType));
  const recordNearbyDevices = async (count: number) => {
    await room.logSecurity("NEARBY_DEVICE_DETECTED", "MEDIUM", {
      nearbyDeviceCount: count,
      evidence: "candidate-browser-relayed-local-companion",
      source: "windows-proximity-companion",
    });
  };

  return (
    <aside className="rounded-2xl border border-cyan-400/30 bg-slate-900 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Security monitor</p>
          <h2 className="mt-1 text-xl font-bold">Live integrity</h2>
        </div>
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[10px] uppercase text-amber-200">Review signal only</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-800 p-3"><p className="text-slate-400">Tab switches</p><p className="mt-1 font-semibold text-amber-300">{tabSwitches}</p></div>
        <div className="rounded-xl bg-slate-800 p-3"><p className="text-slate-400">Window changes</p><p className="mt-1 font-semibold text-cyan-300">{blurFocusEvents}</p></div>
      </div>

      {latestReviewEvent && (
        <div role="status" className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          {latestReviewEvent.eventType === "MULTIPLE_FACE_DETECTED"
            ? `The candidate browser locally counted ${Number(latestReviewEvent.details?.faceCount) || "multiple"} faces in view. Verify the scene; the detector does not identify people.`
            : latestReviewEvent.eventType === "NEARBY_DEVICE_DETECTED"
              ? `${Number(latestReviewEvent.details?.nearbyDeviceCount) || 1} Bluetooth LE advertising signal(s) were reported by the candidate companion. This is not a verified distance or device identity.`
              : latestReviewEvent.eventType === "UNEXPECTED_PARTICIPANT"
                ? "An additional participant joined the room. Verify that everyone present is expected."
                : "Repeated tab switches were observed. Review the session context; browser signals can have benign causes."}
        </div>
      )}

      {room.user?.role === "candidate" && room.session?._id && (
        <WindowsProximityCompanion sessionId={room.session._id} onNewDevices={recordNearbyDevices} />
      )}
      <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm">
        <p className="text-slate-400">Nearby BLE advertisements</p>
        <p className={`mt-1 font-semibold ${nearbyDeviceCount ? "text-amber-300" : "text-slate-200"}`}>{nearbyDeviceCount} reported detections</p>
        <p className="mt-1 text-[11px] text-slate-500">Candidate opt-in Windows scan; counts advertising BLE signals, not device identities. It can miss phones/laptops and cannot prove an exact radius or that other devices are absent.</p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <div className="flex items-end justify-between">
          <div><p className="text-xs uppercase text-slate-500">Integrity score</p><p className="mt-1 text-4xl font-bold text-emerald-300">{score == null ? "--" : `${score}/100`}</p></div>
          <p className="text-sm font-semibold text-emerald-300">Risk: {risk}</p>
        </div>
        <p className="mt-2 text-xs text-slate-500">Random Forest output is a review signal—not evidence of misconduct or a standalone hiring decision.</p>
        {analysis?.training && <p className="mt-1 text-xs text-amber-300">{analysis.training.source} · {analysis.training.sampleCount} training rows</p>}
        {analysis?.training?.warning && <p className="mt-1 text-xs text-slate-400">{analysis.training.warning}</p>}
      </div>

      {currentAnalysisError && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{currentAnalysisError}</p>}
      <div className="mt-4 flex justify-between border-b border-slate-800 py-2 text-xs">
        <span className="text-slate-400">Random Forest</span>
        <span className="text-slate-300">{randomForest ? `${randomForest.label ?? "classified"} · ${randomForest.riskScore ?? "n/a"}/100 · ${randomForest.treeCount ?? "n/a"} trees` : currentAnalysisError || (room.interviewId ? "Analyzing…" : "No interview session")}</span>
      </div>
      <div className="mt-3 flex justify-between border-b border-slate-800 py-2 text-xs">
        <span className="text-slate-400">Temporal CNN</span>
        <span className="text-slate-300">{cnn ? `${cnn.status ?? "trained"} · ${cnn.riskScore ?? "n/a"}/100 · ${(cnn.kernelSizes ?? []).join("/")} kernels` : currentAnalysisError || "Analyzing…"}</span>
      </div>
      {analysis?.validation && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs">
          <p className="font-semibold text-cyan-200">Offline validation snapshot</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300 sm:grid-cols-4">
            <span>Accuracy: {Math.round((analysis.validation.accuracy ?? 0) * 100)}%</span>
            <span>Precision: {Math.round((analysis.validation.macroPrecision ?? 0) * 100)}%</span>
            <span>Recall: {Math.round((analysis.validation.macroRecall ?? 0) * 100)}%</span>
            <span>F1: {Math.round((analysis.validation.macroF1 ?? 0) * 100)}%</span>
          </div>
          <p className="mt-2 text-slate-500">{analysis.validation.method}; {analysis.validation.sampleCount} validation rows.</p>
          {analysis.fairness && <p className="mt-1 text-amber-300">Fairness audit: {analysis.fairness.status}. {analysis.fairness.reason}</p>}
        </div>
      )}
    </aside>
  );
}
