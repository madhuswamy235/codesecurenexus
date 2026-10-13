"use client";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import LiveCodeEditor from "@/components/interview/LiveCodeEditor";

function CodingSurface() { const room = useInterviewRoom(); return <div className="space-y-6"><div><p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Interview mode</p><h1 className="mt-2 text-3xl font-bold">Coding Interview</h1><p className="mt-2 text-slate-400">Monitored, backend-connected coding workspace. Generated schematic objects remain separate from manual drawings.</p></div><LiveCodeEditor interviewId={room.interviewId || undefined} room={room} /></div>; }
export default function InterviewCodingPage() { return <ProtectedWorkspace eyebrow="Interview coding"><CodingSurface /></ProtectedWorkspace>; }
