/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import {
  useInterviewRoom,
  type SecurityEventRow,
  type InterviewRoomController,
} from "@/hooks/useInterviewRoom";

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    sec
  ).padStart(2, "0")}`;
}

function sevColor(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return "text-red-400 border-red-500/40";
    case "HIGH":
      return "text-orange-400 border-orange-500/40";
    case "MEDIUM":
      return "text-yellow-400 border-yellow-500/40";
    default:
      return "text-green-400 border-green-500/40";
  }
}

/**
 * LiveRoomData
 *
 * Real, persisted SecureNexus data wired to the Express backend + Socket.IO:
 * interview/session, questions, security summary + live events, recruiter
 * notes, chat, presence and a synchronized timer. No values here are faked.
 */
export default function LiveRoomData({
  interviewId,
  room,
}: {
  interviewId?: string;
  /** Reuse the parent room controller when one is available. */
  room?: InterviewRoomController;
}) {
  if (room) return <LiveRoomPanel controller={room} />;
  return <StandaloneLiveRoomData interviewId={interviewId} />;
}

function StandaloneLiveRoomData({ interviewId }: { interviewId?: string }) {
  const controller = useInterviewRoom({ interviewId });
  return <LiveRoomPanel controller={controller} />;
}

function LiveRoomPanel({ controller }: { controller: InterviewRoomController }) {
  const [msg, setMsg] = useState("");
  const [noteText, setNoteText] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [tick, setTick] = useState<number | null>(null);

  // Local countdown that syncs from the server's saved timer (or a socket sync).
  useEffect(() => {
    if (controller.loading) return;
    const base =
      controller.timer?.seconds ?? controller.session?.timerSecondsRemaining ?? null;
    if (tick === null && base !== null) setTick(base);
  }, [controller.loading, controller.timer, controller.session, tick]);

  useEffect(() => {
    if (tick === null || tick <= 0) return;
    const id = setInterval(() => setTick((t) => (t === null ? t : Math.max(0, t - 1))), 1000);
    return () => clearInterval(id);
  }, [tick]);

  const liveSeconds =
    controller.timer?.seconds !== undefined ? controller.timer.seconds : tick;
  const aiMode = typeof controller.aiStatus?.mode === "string" ? controller.aiStatus.mode : "file";
  const aiConfigured = typeof controller.aiStatus?.configured === "boolean" ? controller.aiStatus.configured : false;

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    try {
      await controller.saveNote(noteText.trim());
      setNoteText("");
      setSavedNote("Note saved");
      setTimeout(() => setSavedNote(""), 2500);
    } catch {
      setSavedNote("Save failed");
    }
  }
return (
    <div className="rounded-xl bg-slate-900 p-5 shadow-lg border border-cyan-500/30">
      <h2 className="text-xl font-bold text-cyan-400 mb-1">
        Live Room{" "}
        <span className="text-sm font-normal text-emerald-400">
          • real backend
        </span>
      </h2>
      <p className="text-xs text-slate-400 mb-4">
        This panel uses the Express REST + Socket.IO backend. Data below is
        persisted, not simulated.
      </p>

      {/* real-time socket status */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="uppercase tracking-wide text-slate-500">Socket</span>
        {controller.connectionStatus === "reconnecting" ? (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-amber-300">
            reconnecting… auto-rejoin on next connect
          </span>
        ) : controller.connectionStatus === "rejoining" ? (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-amber-300">
            rejoining room…
          </span>
        ) : controller.connectionStatus === "connected" ? (
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
            connected
          </span>
        ) : controller.connectionStatus === "error" ? (
          <span className="rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-red-300">
            room error
          </span>
        ) : (
          <span className="rounded-full bg-slate-700/40 border border-slate-600/40 px-2 py-0.5 text-slate-400">
            connecting…
          </span>
        )}
      </div>

      {controller.loading ? (
        <p className="text-sm text-slate-400">Loading live room data…</p>
      ) : controller.error ? (
        <p className="text-sm text-red-400">{controller.error}</p>
      ) : controller.interview ? (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Interview</span>
            <span className="font-semibold">{controller.interview.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status</span>
            <span className="font-semibold uppercase">
              {controller.session?.status || controller.interview.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Storage</span>
            <span>{aiMode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">AI provider</span>
            <span>
              {aiConfigured ? "configured" : "dev-mock (no key set)"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Questions</span>
            <span>{controller.questions.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Timer</span>
            <span className="font-mono text-cyan-300">
              {formatTime(liveSeconds ?? 0)}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No interview assigned.</p>
      )}
{/* presence */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Who's here
        </p>
        {controller.presence.length === 0 ? (
          <p className="text-xs text-slate-500">
            You are the only participant connected.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {controller.presence.map((m) => (
              <span
                key={m.socketId}
                className="rounded-full bg-cyan-600/20 border border-cyan-500/30 px-3 py-1 text-xs"
              >
                {m.name} <span className="text-slate-400">({m.role})</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* chat */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Live chat
        </p>
        <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg bg-black/30 border border-slate-800 p-2">
          {controller.chat.length === 0 ? (
            <p className="text-xs text-slate-500">No messages yet.</p>
          ) : (
            controller.chat.map((c, i) => (
              <div key={i} className="text-xs">
                <span className="text-cyan-400">
                  {c.senderName || "User"}:{" "}
                </span>
                <span className="text-slate-200">{c.content}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && msg.trim()) {
                controller.sendChat(msg.trim());
                setMsg("");
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-lg bg-black/30 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => {
              if (msg.trim()) {
                controller.sendChat(msg.trim());
                setMsg("");
              }
            }}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm hover:bg-cyan-700"
          >
            Send
          </button>
        </div>
      </div>
{/* live security feed */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Security events (live)
        </p>
        <div className="max-h-40 overflow-y-auto space-y-1.5">
          {controller.liveSecurity.length === 0 ? (
            <p className="text-xs text-slate-500">
              No security events recorded yet.
            </p>
          ) : (
            controller.liveSecurity.map((ev: SecurityEventRow, i) => (
              <div
                key={i}
                className={`rounded-md border px-2 py-1 text-xs ${sevColor(
                  ev.severity || "LOW"
                )}`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{ev.eventType.replace(/_/g, " ")}</span>
                  {ev.eventType === "MULTIPLE_FACE_DETECTED" && typeof ev.details?.faceCount === "number" && (
                    <span className="opacity-80">{ev.details.faceCount} faces in view</span>
                  )}
                  {ev.severity ? <span className="opacity-70">{ev.severity}</span> : null}
                  {(ev.timestamp || ev.createdAt) && (
                    <time className="ml-auto text-slate-500" dateTime={ev.timestamp || ev.createdAt}>
                      {new Date(ev.timestamp || ev.createdAt || "").toLocaleTimeString()}
                    </time>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={() => controller.recordSecurityEvent("TAB_SWITCH", "MEDIUM", { count: 1 })}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
          >
            + Log tab switch
          </button>
        </div>
      </div>

      {/* notes (real) */}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Recruiter notes (persisted)
        </p>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Write interview observations…"
          className="w-full h-20 rounded-lg bg-black/30 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={handleSaveNote}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm hover:bg-cyan-700"
          >
            Save note
          </button>
          {savedNote && (
            <span className="text-xs text-emerald-400">{savedNote}</span>
          )}
        </div>
        {controller.notes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {controller.notes.map((n: any, i: number) => (
              <li key={i} className="text-xs text-slate-300">
                {n.content}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* session controls */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => controller.startInterview()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-700"
        >
          Start
        </button>
        <button
          onClick={() => {
            if (liveSeconds !== null) controller.syncTimer(liveSeconds);
          }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm hover:bg-cyan-700"
        >
          Sync timer
        </button>
        <button
          onClick={() => controller.endInterview()}
          className="rounded-lg bg-red-700 px-4 py-2 text-sm hover:bg-red-800"
        >
          End
        </button>
      </div>
    </div>
  );
}