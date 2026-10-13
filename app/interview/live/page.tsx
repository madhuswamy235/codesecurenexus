"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import VideoMeeting from "@/components/interview/VideoMeeting";

function LiveInterviewContent() {
	const searchParams = useSearchParams();
	const interviewId = searchParams.get("id") || undefined;

	return <ProtectedWorkspace eyebrow="Live interview"><div className="space-y-6"><div><p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Interview session</p><h1 className="mt-2 text-3xl font-bold">Live Interview</h1><p className="mt-2 text-slate-400">Candidate workspace with a secure peer-to-peer interview room.</p></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4"><p className="text-xs text-emerald-200">AI interviewer</p><p className="mt-2 font-semibold">Ready for session</p></div><div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Participants</p><p className="mt-2 font-semibold">Candidate + recruiter</p></div><div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Status</p><p className="mt-2 font-semibold text-emerald-300">WebRTC signaling ready</p></div></div><VideoMeeting interviewId={interviewId} /></div></ProtectedWorkspace>;
}

export default function LiveInterviewPage() {
	return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><LiveInterviewContent /></Suspense>;
}
