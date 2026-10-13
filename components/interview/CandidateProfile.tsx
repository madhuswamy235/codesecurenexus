"use client";

import { User, Mail, GraduationCap, Briefcase } from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * Candidate Profile — reflects the real candidate assigned to the interview
 * (from the enriched interview REST payload), falling back to the logged-in
 * user. No fabricated profile data.
 */
export default function CandidateProfile({
  room,
  user,
}: {
  room: InterviewRoomController;
  user?: { name?: string; email?: string; role?: string } | null;
}) {
  const cand = room.interview?.candidate || null;
  const name = cand?.name || user?.name || "—";
  const email = cand?.email || user?.email || "—";

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-cyan-400 mb-5">Candidate Profile</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <User className="text-cyan-400" />
          <span>Name : {name}</span>
        </div>

        <div className="flex items-center gap-3">
          <Mail className="text-cyan-400" />
          <span>Email : {email}</span>
        </div>

        <div className="flex items-center gap-3">
          <GraduationCap className="text-cyan-400" />
          <span>Qualification : not available in profile</span>
        </div>

        <div className="flex items-center gap-3">
          <Briefcase className="text-cyan-400" />
          <span>Experience : not available in profile</span>
        </div>
      </div>
    </div>
  );
}