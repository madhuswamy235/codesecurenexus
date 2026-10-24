"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleHelp, LayoutDashboard, MessageSquare, Settings2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import LiveRoomData from "./LiveRoomData";
import VideoMeeting from "./VideoMeeting";
import LiveCodeEditor from "./LiveCodeEditor";
import Whiteboard from "./Whiteboard";
import SecurityMonitor from "./SecurityMonitor";
import LiveIntegrityPanel from "./LiveIntegrityPanel";
import InterviewTimer from "./InterviewTimer";
import InterviewControl from "./InterviewControl";
import CandidateProfile from "./CandidateProfile";
import RecruiterNotes from "./RecruiterNotes";
import InterviewReport from "./InterviewReport";
import AIInterviewPanel from "./AIInterviewPanel";

export default function InterviewRoom({ interviewId }: { interviewId?: string }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const room = useInterviewRoom({ interviewId });

  useEffect(() => {
    if (!isAuthenticated) {
      const target = interviewId ? `/interview?id=${encodeURIComponent(interviewId)}` : "/interview";
      router.replace(`/login?next=${encodeURIComponent(target)}`);
    }
  }, [isAuthenticated, router, interviewId]);

  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Checking authentication...</div>;

  const resolvedId = room.interviewId ?? interviewId;
  const running = String(room.timer?.status || room.session?.status || "").toLowerCase() === "active";
  const title = room.interview?.title || "Live interview";
  const isCandidate = room.user?.role === "candidate";

  return <div className="min-h-screen bg-[#07111f] text-white">
    <header className="border-b border-white/10 bg-[#0b1728] px-4 py-4 md:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-4"><Link href="/dashboard" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 font-black text-white">S</Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-lg font-bold">{title}</h1><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${running ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>{running ? "Live" : room.session?.status || "Waiting"}</span></div><p className="mt-1 text-xs text-slate-500">{isCandidate ? "Candidate workspace" : "Interviewer workspace"} · SecureNexus meeting room</p></div></div><div className="flex items-center gap-2"><Link href="/dashboard" className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 sm:flex"><LayoutDashboard size={15} /> Dashboard</Link><button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5" title="Help"><CircleHelp size={17} /></button></div></div></header>

    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 md:px-8">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0"><VideoMeeting interviewId={resolvedId} joinRoom={false} members={room.presence} isCandidate={isCandidate} sessionActive={running} logSecurity={room.logSecurity} /></div>
        <aside className="space-y-5"><InterviewTimer room={room} /><div className="rounded-2xl border border-white/10 bg-[#0d1b2e] p-4"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-400" /><h2 className="font-semibold">Room status</h2></div><p className="text-sm text-slate-400">{room.presence.length ? `${room.presence.length + 1} people in this room` : "Waiting for the other participant"}</p><div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${room.connectionStatus === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />{room.connectionStatus === "connected" ? "Connected" : "Connecting"}</div></div><InterviewControl interviewId={resolvedId} room={room} /></aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]"><details className="group rounded-2xl border border-white/10 bg-[#0d1b2e]" open><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold"><span className="flex items-center gap-2"><MessageSquare size={17} className="text-cyan-300" /> Interview tools</span><ChevronDown size={17} className="text-slate-500 transition group-open:rotate-180" /></summary><div className="border-t border-white/10 p-5"><div className="mb-5"><p className="text-sm text-slate-400">Use these tools when the conversation needs a practical exercise.</p><Link href={resolvedId ? `/interview/assessment?id=${encodeURIComponent(resolvedId)}` : "/interview/assessment"} className="mt-3 inline-flex rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-400">Open assessment</Link></div><div className="grid gap-5 xl:grid-cols-2"><LiveCodeEditor interviewId={resolvedId} room={room} /><Whiteboard interviewId={resolvedId} room={room} /></div></div></details><details className="group rounded-2xl border border-white/10 bg-[#0d1b2e]"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold"><span className="flex items-center gap-2"><Settings2 size={17} className="text-violet-300" /> Review and notes</span><ChevronDown size={17} className="text-slate-500 transition group-open:rotate-180" /></summary><div className="border-t border-white/10 p-5"><div className="grid gap-5 md:grid-cols-2"><LiveIntegrityPanel room={room} /><SecurityMonitor interviewId={resolvedId} room={room} user={room.user} enabled={running} /><CandidateProfile room={room} user={room.user} /><RecruiterNotes room={room} /></div></div></details></section>

      <details className="group rounded-2xl border border-white/10 bg-[#0d1b2e]"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold"><span className="flex items-center gap-2">Session data, chat, and saved events</span><ChevronDown size={17} className="text-slate-500 transition group-open:rotate-180" /></summary><div className="border-t border-white/10 p-5"><LiveRoomData interviewId={resolvedId} room={room} /></div></details>
      <details className="group rounded-2xl border border-white/10 bg-[#0d1b2e]"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold"><span>AI interview analysis and final report</span><ChevronDown size={17} className="text-slate-500 transition group-open:rotate-180" /></summary><div className="grid gap-5 border-t border-white/10 p-5 lg:grid-cols-2"><AIInterviewPanel interviewId={resolvedId || ""} /><InterviewReport /></div></details>
    </main>
  </div>;
}
