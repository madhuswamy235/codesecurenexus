"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

interface InterviewSummary {
  _id: string;
  title: string;
  description?: string;
  status?: string;
  type?: string;
  durationMinutes?: number;
}

/**
 * AssessmentList — lists the authenticated user's interviews and lets them
 * open the real assessment workflow (or view results if completed).
 */

export default function AssessmentList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<InterviewSummary[]>("/interviews");
        if (!cancelled) setInterviews(Array.isArray(res.data) ? res.data : []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load interviews.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusColor: Record<string, string> = {
    draft: "text-slate-400",
    scheduled: "text-yellow-400",
    active: "text-emerald-400",
    completed: "text-green-400",
    cancelled: "text-red-400",
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading…</div>;
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="max-w-md rounded-2xl border border-red-700 bg-red-900/40 p-6 text-red-200">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-cyan-400">My Interviews</h1>
        <p className="mt-1 text-sm text-slate-400">Start your real assessment or view completed results.</p>

        {interviews.length === 0 && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            No interviews assigned yet.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {interviews.map((iv) => (
            <div
              key={iv._id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{iv.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{iv.description || "No description"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className={`font-semibold uppercase ${statusColor[iv.status || "draft"] || "text-slate-400"}`}>
                      {iv.status}
                    </span>
                    <span className="text-slate-500">{iv.type}</span>
                    <span className="text-slate-500">Duration: {iv.durationMinutes || 60} min</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/assessment/${iv._id}`}
                    className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    {iv.status === "completed" ? "Open" : "Start Assessment"}
                  </Link>
                  {iv.status === "completed" && (
                    <Link
                      href={`/assessment/${iv._id}/result`}
                      className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
                    >
                      View Results
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
