"use client";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import LiveCodeEditor from "@/components/interview/LiveCodeEditor";
function LearningCodingSurface() { const room = useInterviewRoom(); return <div className="space-y-6"><div><p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Practice mode</p><h1 className="mt-2 text-3xl font-bold">Learning Coding Lab</h1><p className="mt-2 text-slate-400">Practice with the existing Monaco editor and backend executor. Interview lockdown is not enabled in learning mode.</p></div><LiveCodeEditor interviewId={room.interviewId || undefined} room={room} /></div>; }
export default function LearningCodingPage() { return <ProtectedWorkspace eyebrow="Learning coding"><LearningCodingSurface /></ProtectedWorkspace>; }
