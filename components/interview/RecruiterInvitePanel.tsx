"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Send, Sparkles } from "lucide-react";
import api from "@/lib/api";

type CreatedInterview = { _id?: string; joinLink?: string; title?: string; questions?: unknown[] };

const questionTemplates = {
  MCQ: [{ type: "MCQ", text: "Which structure follows FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], correctOption: 1, maxScore: 1 }],
  CODING: [{ type: "CODING", text: "Write a function that returns the sum of two numbers.", language: "javascript", starterCode: "function solve(a, b) {\n  // your code\n}", testCases: [{ input: "2,3", expected: "5" }], maxScore: 10 }],
  WRITTEN: [{ type: "WRITTEN", text: "Explain how you would design a URL shortener for one million daily users.", maxScore: 10 }],
};

export default function RecruiterInvitePanel() {
  const [title, setTitle] = useState("Technical Interview");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [type, setType] = useState<"LIVE" | "MIXED" | "MCQ" | "CODING">("MIXED");
  const [duration, setDuration] = useState("60");
  const [result, setResult] = useState<CreatedInterview | null>(null);
  const [scanLink, setScanLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResult(null);
    setScanLink("");
    try {
      const questions = type === "MIXED" ? Object.values(questionTemplates).flat() : type === "LIVE" ? [] : questionTemplates[type];
      const response = await api.post<CreatedInterview>("/interviews", { title, candidateEmail, type, durationMinutes: Number(duration), questions });
      setResult(response.data || null);
      setMessage("Invitation created. Copy the link and send it to the candidate.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!result?.joinLink) return;
    await navigator.clipboard.writeText(result.joinLink);
    setMessage("Candidate invitation link copied.");
  }

  async function createScanLink() {
    if (!result?._id) return;
    try {
      const response = await api.post<{ url?: string }>(`/room-scans/interviews/${result._id}/token`);
      setScanLink(response.data?.url || "");
      setMessage(response.data?.url ? "Room-scan link ready. Send it before the Google Meet link." : "Room-scan link was not returned.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the room-scan link.");
    }
  }

  async function copyScanLink() {
    if (!scanLink) return;
    await navigator.clipboard.writeText(scanLink);
    setMessage("Room-scan link copied.");
  }

  return <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-6 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-white"><Sparkles size={21} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Recruiter tools</p><h2 className="mt-1 text-xl font-bold text-slate-950">Invite a candidate</h2><p className="mt-1 text-sm text-slate-600">Create one link for Google Meet, room scan, and the coding / MCQ / written assessment.</p></div></div><form onSubmit={(event) => void createInvite(event)} className="mt-5 grid gap-3 md:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Interview title" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" required /><input type="email" value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} placeholder="Candidate email" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400" required /><select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"><option value="MIXED">Google Meet + all assessments</option><option value="LIVE">Google Meet only</option><option value="CODING">Google Meet + coding</option><option value="MCQ">Google Meet + MCQ</option></select><select value={duration} onChange={(event) => setDuration(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select><button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 md:col-span-2">{busy ? "Creating invitation..." : "Create invitation link"} <Send size={16} /></button></form>{message && <p role="status" className="mt-4 text-sm font-medium text-violet-800">{message}</p>}{result?.joinLink && <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 size={17} className="text-emerald-600" /> Invitation ready</div><p className="mt-3 break-all rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{result.joinLink}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void copyLink()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"><Copy size={15} /> Copy candidate link</button><button type="button" onClick={() => void createScanLink()} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100">Create room-scan link</button></div>{scanLink && <><p className="mt-3 break-all rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{scanLink}</p><button type="button" onClick={() => void copyScanLink()} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"><Copy size={14} /> Copy room-scan link</button></>}</div>}</section>;
}
