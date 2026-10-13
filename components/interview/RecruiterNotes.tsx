/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useState } from "react";
import { ClipboardList, Save } from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * Recruiter Notes — wired to the real notes backend through the room
 * controller (POST /api/notes + persisted list). No dead buttons.
 */
export default function RecruiterNotes({
  room,
}: {
  room: InterviewRoomController;
}) {
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const text = notes.trim();
    if (!text) return setMsg("Write some notes first.");
    setBusy(true);
    setMsg("");
    try {
      await room.saveNote(text);
      setNotes("");
      setMsg("Note saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch (err: any) {
      setMsg(err?.message || "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-cyan-400 mb-5">Recruiter Notes</h2>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Write interview observations..."
        className="w-full h-40 bg-black text-white rounded-lg p-4 border border-gray-700 outline-none focus:border-cyan-500"
      />

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 bg-cyan-600 px-5 py-3 rounded-lg flex items-center gap-2 hover:bg-cyan-700 disabled:opacity-60"
      >
        <Save size={18} /> {busy ? "Saving…" : "Save Notes"}
      </button>

      {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}

      {room.notes.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Saved notes (persisted)
          </p>
          <ul className="space-y-1">
            {room.notes.map((n: any, i: number) => (
              <li key={i} className="text-xs text-slate-300">
                <ClipboardList size={12} className="inline mr-1 text-cyan-400" />
                {n.content}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}