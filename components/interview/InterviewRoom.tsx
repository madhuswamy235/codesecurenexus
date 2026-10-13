"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import SecurityAlert from "./SecurityAlert";
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

  if (!isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Checking authentication...</div>;
  }

  const resolvedId = room.interviewId ?? interviewId;
  const running = String(room.timer?.status || room.session?.status || "").toLowerCase() === "active";

  return <div className="min-h-screen bg-slate-950 px-4 py-6 text-white md:px-8">
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
      <div><p className="text-xs uppercase tracking-[0.25em] text-emerald-300">SecureNexus</p><h1 className="mt-1 text-3xl font-bold">Interview Workspace</h1><p className="mt-1 text-sm text-slate-400">Candidate and recruiter room with live video, coding, and collaborative whiteboard.</p></div>
      <div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs uppercase ${running ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-slate-700 bg-slate-900 text-slate-400"}`}>{room.timer?.status || room.session?.status || "NOT_STARTED"}</span><Link href="/dashboard" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-emerald-400/50">Dashboard</Link></div>
    </header>

    <main className="mx-auto max-w-7xl space-y-6 pt-6">
      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <VideoMeeting
          interviewId={resolvedId}
          joinRoom={false}
          members={room.presence}
          isCandidate={room.user?.role === "candidate"}
          sessionActive={running}
          logSecurity={room.logSecurity}
        />
        <div className="space-y-4"><LiveIntegrityPanel room={room} /><SecurityMonitor interviewId={resolvedId} room={room} user={room.user} enabled={running} /></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <InterviewTimer room={room} />
        <InterviewControl interviewId={resolvedId} room={room} />
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs uppercase tracking-wide text-slate-500">Interview assessment</p><h2 className="mt-2 text-xl font-semibold">MCQ, coding, and written</h2><p className="mt-2 text-sm text-slate-400">{room.questions.length ? `${room.questions.length} question${room.questions.length === 1 ? "" : "s"} assigned.` : "No questions are assigned to this interview yet. Add questions before opening the assessment."}</p><Link href={resolvedId ? `/interview/assessment?id=${encodeURIComponent(resolvedId)}` : "/interview/assessment"} className="mt-4 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400">{room.questions.length ? "Open assessment" : "Open assessment setup"}</Link></div>
      </section>

      <section className="rounded-2xl border border-cyan-400/20 bg-slate-900/60 p-4 md:p-6"><div className="mb-5"><p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Connected workspace</p><h2 className="mt-1 text-2xl font-bold">Coding to schematic</h2><p className="mt-1 text-sm text-slate-400">Monaco changes are debounced, parsed into generated sc_* operations, and synchronized beside the board. Manual wb_* drawings are preserved.</p></div><div className="grid gap-6 xl:grid-cols-2"><LiveCodeEditor interviewId={resolvedId} room={room} /><Whiteboard interviewId={resolvedId} room={room} /></div></section>

      <LiveRoomData interviewId={resolvedId} room={room} />

      <section className="grid gap-6 lg:grid-cols-2"><AIInterviewPanel interviewId={resolvedId || ""} /><SecurityAlert room={room} /><CandidateProfile room={room} user={room.user} /><RecruiterNotes room={room} /><InterviewReport /></section>
    </main>
  </div>;
}
