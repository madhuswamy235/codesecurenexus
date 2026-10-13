"use client";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import { useInterviewRoom } from "@/hooks/useInterviewRoom";
import Whiteboard from "@/components/interview/Whiteboard";
function BoardSurface() { const room = useInterviewRoom(); return <div className="space-y-6"><div><p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Collaborative practice</p><h1 className="mt-2 text-3xl font-bold">Learning Whiteboard</h1><p className="mt-2 text-slate-400">Drawing and realtime operations reuse the existing Socket.IO whiteboard contract.</p></div><Whiteboard interviewId={room.interviewId || undefined} room={room} /></div>; }
export default function LearningWhiteboardPage() { return <ProtectedWorkspace eyebrow="Learning whiteboard"><BoardSurface /></ProtectedWorkspace>; }
