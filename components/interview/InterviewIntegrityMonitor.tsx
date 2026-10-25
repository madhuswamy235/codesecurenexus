"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eye, Radio, ShieldCheck } from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";
import { useLocalFaceCount } from "@/hooks/useLocalFaceCount";
import WindowsProximityCompanion from "@/components/interview/WindowsProximityCompanion";

export default function InterviewIntegrityMonitor({ room }: { room: InterviewRoomController }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [message, setMessage] = useState("Monitoring is off until you are ready to start the interview.");

  const logSecurity = useCallback((eventType: string, severity: string, details: Record<string, unknown>) => {
    return room.logSecurity(eventType, severity, { ...details, source: "interview-integrity-monitor" });
  }, [room.logSecurity]);

  const onMultipleFaces = useCallback((faceCount: number) => logSecurity("MULTIPLE_FACE_DETECTED", "MEDIUM", { faceCount }), [logSecurity]);
  const onCameraObscured = useCallback(() => logSecurity("CAMERA_OBSCURED", "MEDIUM", { reason: "no-face-visible" }), [logSecurity]);
  const faceMonitor = useLocalFaceCount({ enabled: monitoring && cameraReady, videoRef, onMultipleFaces, onCameraObscured });

  useEffect(() => {
    if (!monitoring) return;
    const onVisibility = () => {
      if (!document.hidden) return;
      setTabSwitches((count) => count + 1);
      void logSecurity("TAB_SWITCH", "HIGH", { visibility: "hidden" });
    };
    const onBlur = () => void logSecurity("WINDOW_BLUR", "MEDIUM", {});
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [logSecurity, monitoring]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startMonitoring() {
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setMonitoring(true);
      setMessage("Monitoring is active. Keep this tab open while you use Google Meet in another tab.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Camera permission is required for monitoring.");
    }
  }

  function stopMonitoring() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setMonitoring(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    setMessage("Monitoring is off.");
  }

  async function recordNearbyDevices(count: number) {
    await logSecurity("NEARBY_DEVICE_DETECTED", "MEDIUM", { nearbyDeviceCount: count });
  }

  return <section className="rounded-3xl border border-slate-700 bg-[#0d1b2e] p-6 shadow-xl shadow-black/20">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Interview safety</p><h2 className="mt-2 text-xl font-bold text-slate-900">Integrity monitor</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Optional review signals record tab switches, window focus changes, local face counts, and Bluetooth companion reports. These are signals for human review, not proof of misconduct.</p></div><button type="button" onClick={() => void (monitoring ? stopMonitoring() : startMonitoring())} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white ${monitoring ? "bg-slate-700 hover:bg-slate-800" : "bg-emerald-600 hover:bg-emerald-500"}`}>{monitoring ? "Stop monitoring" : "Start monitoring"}</button></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-4"><Status icon={Eye} label="Tab switches" value={String(tabSwitches)} tone={tabSwitches ? "amber" : "slate"} /><Status icon={Camera} label="Face scan" value={monitoring ? faceMonitor.faceCount == null ? "Starting" : `${faceMonitor.faceCount} visible` : "Off"} tone={faceMonitor.faceCount && faceMonitor.faceCount > 1 ? "amber" : "slate"} /><Status icon={Radio} label="Bluetooth" value="Companion" tone="slate" /><Status icon={ShieldCheck} label="Status" value={monitoring ? "Active" : "Ready"} tone={monitoring ? "green" : "slate"} /></div>
    {monitoring && <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]"><video ref={videoRef} muted playsInline className="aspect-video w-full rounded-2xl bg-slate-950 object-cover" /><div><p className="text-sm font-semibold text-slate-900">Camera review</p><p className="mt-2 text-sm leading-6 text-slate-600">{faceMonitor.status === "active" ? "Face counting is running locally in this browser." : faceMonitor.status === "loading" ? "Starting the local face detector..." : faceMonitor.error || "Face counting is unavailable; other monitoring remains active."}</p>{faceMonitor.faceCount !== null && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Current camera count: <strong>{faceMonitor.faceCount}</strong> face{faceMonitor.faceCount === 1 ? "" : "s"} visible.</p>}</div></div>}
    {room.session?._id && <WindowsProximityCompanion sessionId={room.session._id} onNewDevices={recordNearbyDevices} />}
    <p className="mt-4 text-xs leading-5 text-slate-500">Bluetooth scanning requires the optional Windows companion. A browser cannot reliably inspect all nearby radios, and no device identity or exact distance is inferred.</p>
    {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}
  </section>;
}

function Status({ icon: Icon, label, value, tone }: { icon: typeof Eye; label: string; value: string; tone: "green" | "amber" | "slate" }) {
  const colors = tone === "green" ? "text-emerald-700 bg-emerald-50" : tone === "amber" ? "text-amber-700 bg-amber-50" : "text-slate-700 bg-slate-50";
  return <div className={`rounded-2xl p-4 ${colors}`}><Icon size={18} /><p className="mt-3 text-xs font-medium opacity-70">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>;
}
