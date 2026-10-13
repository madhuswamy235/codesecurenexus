/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * Interview Timer
 *
 * Receives the authoritative timer from the room controller. The room controller
 * subscribes to the backend timer-sync events and session REST state (server
 * persisted). A local countdown ticks every second between syncs; a new socket
 * sync or session value always wins.
 */
export default function InterviewTimer({
  room,
}: {
  room: InterviewRoomController;
}) {
  const [tick, setTick] = useState<number | null>(null);

  const base =
    room.timer?.seconds ??
    (typeof room.session?.timerSecondsRemaining === "number"
      ? room.session.timerSecondsRemaining
      : null);

  useEffect(() => {
    if (tick === null && base !== null) setTick(base);
  }, [base, tick]);

  useEffect(() => {
    if (tick === null || tick <= 0) return;
    const id = setInterval(
      () => setTick((t) => (t === null ? t : Math.max(0, t - 1))),
      1000
    );
    return () => clearInterval(id);
  }, [tick]);

  const seconds = room.timer?.seconds !== undefined ? room.timer.seconds : tick;
  const status = room.timer?.status || room.session?.status || "pending";

  const hours = Math.floor((seconds || 0) / 3600);
  const minutes = Math.floor(((seconds || 0) % 3600) / 60);
  const secs = (seconds || 0) % 60;

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-cyan-400 mb-0">Interview Timer</h2>
        <span className="rounded-full px-3 py-0.5 text-xs border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 uppercase tracking-wide">
          {status}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Clock className="text-cyan-400" size={32} />
        <span className="text-4xl font-bold">
          {String(hours).padStart(2, "0")}:
          {String(minutes).padStart(2, "0")}:
          {String(secs).padStart(2, "0")}
        </span>
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-500">
        Synced from the server session + socket timer-sync. This is the same
        persisted timer the backend restores on refresh/reconnect.
      </p>
    </div>
  );
}