"use client";

import { use, useEffect, useRef, useState } from "react";
import { config } from "@/config";

type ScanInfo = { interview?: { title?: string; candidateName?: string }; expiresAt?: string; status?: string; consentAccepted?: boolean };

export default function RoomScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [info, setInfo] = useState<ScanInfo | null>(null);
  const [consent, setConsent] = useState(false);
  const [phoneAway, setPhoneAway] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${config.apiUrl}/room-scans/token/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.message || "Invalid room-scan link"); return body.data as ScanInfo; })
      .then((data) => { if (active) setInfo(data); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load this room-scan link."); });
    return () => { active = false; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [token]);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCameraReady(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Camera permission is required for the room scan."); }
  }

  function stopCamera() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); if (videoRef.current) videoRef.current.srcObject = null; }

  function recordVideo() {
    if (!streamRef.current || !consent) return;
    chunksRef.current = [];
    const mimeType = ["video/webm;codecs=vp9", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => { setRecording(false); setHasRecording(chunksRef.current.length > 0); };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 30000);
  }

  async function upload() {
    if (!consent || !hasRecording) { setError("Accept consent and record the room before uploading."); return; }
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.append("consentAccepted", "true");
      form.append("phoneAwayConfirmed", String(phoneAway));
      form.append("media", new Blob(chunksRef.current, { type: "video/webm" }), "room-scan.webm");
      const response = await fetch(`${config.apiUrl}/room-scans/token/${encodeURIComponent(token)}/upload`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Upload failed");
      setMessage("Room scan uploaded. You can close this page; the recruiter will review it.");
      stopCamera();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to upload the room scan."); } finally { setBusy(false); }
  }

  if (error && !info) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-red-200"><div className="max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6">{error}</div></main>;
  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-10">
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">SecureNexus · consented room scan</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Show your interview space</h1>
      <p className="mt-3 text-sm leading-6 text-slate-300">{info?.interview?.title || "Interview room"}. This one-time link expires {info?.expiresAt ? new Date(info.expiresAt).toLocaleString() : "soon"}. The recruiter will receive the uploaded recording for human review.</p>
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-700 bg-black"><video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" /></div>
      <div className="mt-5 space-y-3 text-sm text-slate-300">
        <label className="flex gap-3"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" /> I consent to recording and sharing this room scan with the recruiter for this interview.</label>
        <label className="flex gap-3"><input type="checkbox" checked={phoneAway} onChange={(event) => setPhoneAway(event.target.checked)} className="mt-1" /> I confirm that I have placed my phone away from my workspace. This is my self-report and is not proof of physical placement.</label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => void startCamera()} disabled={recording || Boolean(message)} className="rounded-xl border border-cyan-500/40 px-4 py-3 font-semibold text-cyan-100 disabled:opacity-50">{cameraReady ? "Camera ready" : "Allow camera"}</button><button onClick={recordVideo} disabled={!consent || !cameraReady || recording || Boolean(message)} className="rounded-xl bg-cyan-600 px-4 py-3 font-semibold disabled:opacity-50">{recording ? "Recording 30 seconds…" : "Record room scan"}</button></div>
      <button onClick={() => void upload()} disabled={busy || recording || !hasRecording || Boolean(message)} className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold disabled:opacity-50">{busy ? "Uploading securely…" : "Upload for recruiter review"}</button>
      <p className="mt-5 text-xs leading-5 text-slate-500">Camera access requires HTTPS on a phone (localhost is permitted for local testing). SecureNexus does not claim to detect every nearby device or measure an exact distance.</p>
    </div>
  </main>;
}
