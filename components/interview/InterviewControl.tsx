"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  Flag,
  RefreshCw,
  Shield,
} from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * Interview Control Panel
 *
 * Wired to the real session + timer backend:
 *  - Start   -> POST /api/interviews/:id/start + socket timer:control (start)
 *  - Pause   -> socket timer:control (pause)  [persisted server-side]
 *  - Resume  -> socket timer:control (resume)
 *  - End     -> POST /api/interviews/:id/end + socket timer:control (end)
 *  - Submit  -> navigates to the real candidate assessment page
 *  - Secure  -> honest note: browser-observed security events only (no fake AI)
 */
export default function InterviewControl({
  interviewId,
  room,
}: {
  interviewId?: string;
  room: InterviewRoomController;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  function statusLine(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(""), 3000);
  }

  async function start() {
    if (!interviewId) return statusLine("No interview selected.");
    setBusy("start");
    try {
      const res = await room.startInterview();
      const secs = (interviewId && room.session?.timerSecondsRemaining) ||
        (room.interview?.durationMinutes || 60) * 60;
      room.sendTimerControl("start", Number(secs) || 3600);
      statusLine(res ? "Interview started." : "Interview started.");
    } catch (err: unknown) {
      statusLine(err instanceof Error ? err.message : "Start failed.");
    } finally {
      setBusy("");
    }
  }

  function pause() {
    if (!interviewId) return statusLine("No interview selected.");
    room.sendTimerControl("pause");
    statusLine("Timer paused.");
  }

  function resume() {
    if (!interviewId) return statusLine("No interview selected.");
    const secs = room.timer?.seconds ?? room.session?.timerSecondsRemaining ?? 3600;
    room.sendTimerControl("resume", Number(secs));
    statusLine("Timer resumed.");
  }

  async function end() {
    if (!interviewId) return statusLine("No interview selected.");
    if (!window.confirm("Are you sure you want to end this interview?")) return;
    setBusy("end");
    try {
      await room.endInterview();
      room.sendTimerControl("end");
      statusLine("Interview ended.");
    } catch (err: unknown) {
      statusLine(err instanceof Error ? err.message : "End failed.");
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    if (!interviewId) return statusLine("No interview selected.");
    if (!window.confirm("Are you sure you want to cancel this interview?")) return;
    setBusy("cancel");
    try {
      await room.cancelInterview();
      room.sendTimerControl("cancel");
      statusLine("Interview cancelled.");
    } catch (err: unknown) {
      statusLine(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setBusy("");
    }
  }

  function submit() {
    if (!interviewId) {
      statusLine("No interview selected to submit.");
      return;
    }
    router.push(`/assessment/${interviewId}`);
  }

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-cyan-400 mb-5">
        Interview Control Panel
      </h2>

      <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
        State: <span className="font-semibold text-cyan-300">{room.timer?.status || room.session?.status || "NOT_STARTED"}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={start}
          disabled={busy === "start" || ["active", "paused", "completed", "cancelled"].includes(room.timer?.status || room.session?.status || "")}
          className="bg-green-600 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-60"
        >
          <Play size={18} /> {busy === "start" ? "Starting…" : "Start"}
        </button>

        <button
          onClick={pause}
          disabled={busy !== "" || (room.timer?.status || room.session?.status) !== "active"}
          className="bg-yellow-500 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-yellow-600"
        >
          <Pause size={18} /> Pause
        </button>

        <button
          onClick={end}
          disabled={busy !== "" || !["active", "paused"].includes(room.timer?.status || room.session?.status || "")}
          className="bg-red-600 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-red-700 disabled:opacity-60"
        >
          <Square size={18} /> {busy === "end" ? "Ending…" : "End"}
        </button>

        <button
          onClick={resume}
          disabled={busy !== "" || (room.timer?.status || room.session?.status) !== "paused"}
          className="bg-cyan-600 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-cyan-700"
        >
          <RefreshCw size={18} /> Resume
        </button>

        <button
          onClick={submit}
          disabled={!interviewId}
          className="bg-purple-600 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-700"
        >
          <Flag size={18} /> Submit
        </button>

        <button
          onClick={() => statusLine("Secure mode: browser security events are logged to the backend. No fake AI detection is claimed.")}
          className="bg-blue-600 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700"
        >
          <Shield size={18} /> Secure Mode
        </button>

        <button
          onClick={cancel}
          disabled={busy !== "" || !["active", "paused"].includes(room.timer?.status || room.session?.status || "")}
          className="bg-red-900 p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-red-800 disabled:opacity-60"
        >
          <Square size={18} /> {busy === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>

      {msg && <p className="mt-4 text-sm text-cyan-300">{msg}</p>}
    </div>
  );
}