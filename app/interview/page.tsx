"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Copy, ExternalLink, Video } from "lucide-react";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import api from "@/lib/api";
import LiveCodeEditor from "@/components/interview/LiveCodeEditor";
import Whiteboard from "@/components/interview/Whiteboard";
import InterviewIntegrityMonitor from "@/components/interview/InterviewIntegrityMonitor";
import RecruiterInvitePanel from "@/components/interview/RecruiterInvitePanel";
import { canCreateInterviewsForRole } from "@/hooks/useAuth";

const meetUrl = "https://meet.google.com/new";

function InterviewContent() {
  const room = useInterviewRoom();
  const [copied, setCopied] = useState(false);
  const [scanLink, setScanLink] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  async function copyMeetLink() {
    await navigator.clipboard.writeText(meetUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function createRoomScanLink() {
    if (!room.interviewId) {
      setScanMessage("Select an interview from the dashboard before creating a room-scan link.");
      return;
    }
    setScanBusy(true);
    setScanMessage("");
    try {
      const response = await api.post<{ url?: string }>(`/room-scans/interviews/${room.interviewId}/token`);
      setScanLink(response.data?.url || "");
      setScanMessage(response.data?.url ? "Room-scan link ready to send before the interview." : "The room-scan link was not returned.");
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : "Unable to create the room-scan link.");
    } finally {
      setScanBusy(false);
    }
  }

  async function copyScanLink() {
    if (!scanLink) return;
    await navigator.clipboard.writeText(scanLink);
    setScanMessage("Room-scan link copied.");
  }

  return (
    <div className="mx-auto max-w-6xl [&_.bg-white]:!bg-[#0d1b2e] [&_.text-slate-900]:!text-white [&_.text-slate-800]:!text-slate-100 [&_.text-slate-700]:!text-slate-300 [&_.text-slate-600]:!text-slate-400 [&_.text-slate-500]:!text-slate-400 [&_.border-slate-200]:!border-slate-700">
      <div className="rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-10">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500 text-white"><Video size={28} /></div>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Interview</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Meet on Google Meet</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">Use Google Meet for your interview video call. No extra interview room or session setup is needed here.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href={meetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3.5 font-semibold text-white hover:bg-emerald-400">Open Google Meet <ExternalLink size={18} /></a>
          <button type="button" onClick={copyMeetLink} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 font-semibold text-slate-200 hover:border-emerald-300 hover:text-white">{copied ? <CheckCircle2 size={18} className="text-emerald-300" /> : <Copy size={18} />}{copied ? "Link copied" : "Copy Meet link"}</button>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {["Open the Meet link", "Allow camera and microphone", "Share the link with attendees"].map((step, index) => <div key={step} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">{index + 1}</span><p className="mt-4 text-sm font-semibold text-slate-800">{step}</p></div>)}
      </div>
      <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Invite people</p><h2 className="mt-2 text-lg font-bold text-slate-900">Create the Google Meet, then share its link</h2><p className="mt-2 text-sm leading-6 text-slate-700">Open Google Meet, choose <strong>New meeting</strong>, copy the joining link, and send it by email or chat. Attendees can join from the link without using a SecureNexus interview session.</p><ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700"><li>Click <strong>Open Google Meet</strong>.</li><li>In Meet, select <strong>Start an instant meeting</strong> or schedule one in Google Calendar.</li><li>Copy the meeting link and send it to everyone.</li></ol></div>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Before joining</p><h2 className="mt-2 text-lg font-bold text-slate-900">Send a room-scan link first</h2><p className="mt-2 text-sm leading-6 text-slate-700">The participant should open the one-time link, show the entire room for 30 seconds, and upload it. Start the interview only after the scan is complete.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => void createRoomScanLink()} disabled={scanBusy} className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60">{scanBusy ? "Creating link..." : "Create room-scan link"}</button>{scanLink && <button type="button" onClick={() => void copyScanLink()} className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100">Copy room-scan link</button>}</div>{scanLink && <p className="mt-3 break-all rounded-xl bg-white p-3 text-xs text-slate-700">{scanLink}</p>}{scanMessage && <p role="status" className="mt-3 text-sm text-amber-800">{scanMessage}</p>}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/learning/whiteboard" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Keep collaborating</p><h2 className="mt-2 text-lg font-bold text-slate-800">Collaborative whiteboard</h2><p className="mt-2 text-sm leading-6 text-slate-500">Sketch ideas, diagrams, and solutions together.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Open whiteboard <ArrowRight size={15} /></span></Link>
        <Link href="/learning/coding" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">Keep building</p><h2 className="mt-2 text-lg font-bold text-slate-800">Monaco coding editor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Write, run, and save code in the existing editor.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700">Open coding lab <ArrowRight size={15} /></span></Link>
      </div>
      {canCreateInterviewsForRole(room.user?.role) && <div className="mt-8"><RecruiterInvitePanel /></div>}
      <div className="mt-8 space-y-6"><InterviewIntegrityMonitor room={room} /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Collaborative interview workspace</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Meet, code, and draw side by side</h2><p className="mt-2 text-sm text-slate-600">Keep Google Meet open in another tab while the Monaco editor and realtime whiteboard stay available here.</p></div><div className="grid gap-6 xl:grid-cols-2"><LiveCodeEditor interviewId={room.interviewId || undefined} room={room} /><Whiteboard interviewId={room.interviewId || undefined} room={room} /></div></div>
    </div>
  );
}

export default function InterviewPage() {
  return <ProtectedWorkspace eyebrow="Interview" dark><InterviewContent /></ProtectedWorkspace>;
}
