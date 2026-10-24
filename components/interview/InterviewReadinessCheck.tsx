"use client";

import { useCallback, useState } from "react";

type PermissionState = "unknown" | "granted" | "denied" | "unavailable";

interface InterviewReadinessCheckProps {
  role: "candidate" | "interviewer";
  onReadyChange?: (ready: boolean) => void;
}

export default function InterviewReadinessCheck({ role, onReadyChange }: InterviewReadinessCheckProps) {
  const [camera, setCamera] = useState<PermissionState>("unknown");
  const [microphone, setMicrophone] = useState<PermissionState>("unknown");
  const [cameraCount, setCameraCount] = useState(0);
  const [microphoneCount, setMicrophoneCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const checkDevices = useCallback(async () => {
    setBusy(true);
    setMessage("");
    let stream: MediaStream | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera("unavailable");
        setMicrophone("unavailable");
        setMessage("This browser does not support camera and microphone access.");
        onReadyChange?.(false);
        return;
      }

      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput").length;
      const microphones = devices.filter((device) => device.kind === "audioinput").length;
      setCameraCount(cameras);
      setMicrophoneCount(microphones);
      setCamera(stream.getVideoTracks().length > 0 ? "granted" : "denied");
      setMicrophone(stream.getAudioTracks().length > 0 ? "granted" : "denied");
      onReadyChange?.(cameras > 0 && microphones > 0);
      setMessage("Camera and microphone are ready. You can continue to the interview.");
    } catch (error) {
      const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
      setCamera(denied ? "denied" : "unavailable");
      setMicrophone(denied ? "denied" : "unavailable");
      onReadyChange?.(false);
      setMessage(denied
        ? "Camera or microphone access was blocked. Allow both in the browser address bar, then try again."
        : "We could not access the camera and microphone. Connect them and try again.");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setBusy(false);
    }
  }, [onReadyChange]);

  const statusLabel = (value: PermissionState) => value === "unknown" ? "Not checked" : value[0].toUpperCase() + value.slice(1);
  const ready = camera === "granted" && microphone === "granted";

  return (
    <section className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4" aria-labelledby="interview-readiness-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="interview-readiness-title" className="font-semibold text-cyan-100">Quick device check</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {role === "candidate" ? "Allow camera and microphone access before joining. Keep other Bluetooth devices disconnected." : "Allow camera and microphone access before opening the live workspace."}
          </p>
        </div>
        <button type="button" onClick={() => void checkDevices()} disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50">
          {busy ? "Checking..." : ready ? "Check again" : "Allow camera & microphone"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <p className={`rounded-lg border px-3 py-2 ${camera === "granted" ? "border-emerald-500/30 text-emerald-200" : camera === "denied" ? "border-red-500/30 text-red-200" : "border-slate-700 text-slate-300"}`}>
          Camera: {statusLabel(camera)}{cameraCount ? ` (${cameraCount} found)` : ""}
        </p>
        <p className={`rounded-lg border px-3 py-2 ${microphone === "granted" ? "border-emerald-500/30 text-emerald-200" : microphone === "denied" ? "border-red-500/30 text-red-200" : "border-slate-700 text-slate-300"}`}>
          Microphone: {statusLabel(microphone)}{microphoneCount ? ` (${microphoneCount} found)` : ""}
        </p>
      </div>

      {message && <p role={ready ? "status" : "alert"} className={`mt-3 text-xs ${ready ? "text-emerald-300" : "text-amber-200"}`}>{message}</p>}
      {role === "candidate" && <p className="mt-3 text-[11px] leading-5 text-slate-500">Bluetooth note: a normal browser cannot inspect every paired device. If the Windows companion is available below, run it before joining; any nearby BLE signals will be reported and you should disconnect unapproved devices.</p>}
    </section>
  );
}
