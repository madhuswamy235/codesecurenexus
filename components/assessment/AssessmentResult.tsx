/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

/**
 * AssessmentResult — shows REAL stored results from the backend.
 * MCQ scores and coding test-case results are genuinely computed.
 * Written answers use the deterministic word-count heuristic and are clearly
 * labelled as DEV (not AI). Nothing here is fabricated.
 */

export default function AssessmentResult({ interviewId }: { interviewId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interview, setInterview] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [finalSub, setFinalSub] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [ivRes, subRes] = await Promise.all([
          api.get(`/interviews/${interviewId}`),
          api.get(`/submissions?interviewId=${interviewId}`),
        ]);
        if (cancelled) return;
        setInterview(ivRes.data);
        const rows = Array.isArray(subRes.data) ? (subRes.data as any[]) : [];
        setSubs(rows);
        setFinalSub(rows.find((r) => r.type === "FINAL") || null);
      } catch (err: any) {
        setError(err.message || "Failed to load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading results…</div>;
  }
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-red-700 bg-red-900/40 p-6 text-red-200">{error}</div>
      </div>
    );
  }

  const mcqRows = subs.filter((s) => s.type === "MCQ" && s.questionId);
  const mcqAgg = subs.find((s) => s.type === "MCQ" && !s.questionId && s.status === "evaluated");
  const codeRows = subs.filter((s) => s.type === "CODING");
  const overall = finalSub?.score;
  const overallMax = finalSub?.maxScore;

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold text-cyan-400">{interview?.title || "Assessment Results"}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Interview status: <span className="uppercase text-emerald-400">{interview?.status}</span>
        </p>

        {!finalSub && (
          <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300">
            You have not submitted this assessment yet. Results shown below are from your saved/answered sections.
          </div>
        )}

        {/* Overall */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-500/40 bg-slate-900 p-6 text-center">
            <p className="text-slate-400">Overall Score</p>
            <p className="mt-2 text-4xl font-bold text-green-400">
              {overall === undefined ? "—" : `${overall}/${overallMax}`}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
            <p className="text-slate-400">Submitted</p>
            <p className="mt-2 text-2xl font-bold text-cyan-400">
              {finalSub ? new Date(finalSub.submittedAt).toLocaleString() : "Not submitted"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
            <p className="text-slate-400">Sections</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {finalSub?.evaluation?.perSection?.filter((s: any) => s.status === "evaluated").length || 0}/2
            </p>
          </div>
        </div>

        {/* MCQ */}
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-green-400">MCQ Results (real scoring)</h2>
          {mcqAgg ? (
            <p className="mt-2 text-lg">
              Score: <span className="font-bold">{mcqAgg.score}/{mcqAgg.maxScore}</span> ({mcqAgg.evaluation?.percentage}%)
            </p>
          ) : (
            <p className="mt-2 text-slate-400">Not submitted.</p>
          )}
          <ul className="mt-4 space-y-2 text-sm">
            {mcqRows.map((r) => (
              <li key={r._id} className="flex justify-between rounded-lg bg-black/30 p-3">
                <span className="truncate text-slate-300">Q: {r.questionId}</span>
                <span className="font-bold text-green-400">{r.score}/{r.maxScore}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            MCQ marks are genuinely computed against the stored correct answers.
          </p>
        </section>

        {/* Coding */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold text-cyan-400">Coding Results (test cases)</h2>
          {codeRows.length === 0 && <p className="mt-2 text-slate-400">No coding submissions.</p>}
          <ul className="mt-4 space-y-2 text-sm">
            {codeRows.map((r) => (
              <li key={r._id} className="flex justify-between rounded-lg bg-black/30 p-3">
                <span className="text-slate-300">{r.language} · {r.questionId}</span>
                <span className="font-bold text-cyan-400">
                  {r.evaluation?.testCasesPassed}/{r.evaluation?.testCasesTotal} · {r.score}/{r.maxScore}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Test-case pass counts are real (DEV_EXECUTOR). Execution only supported for JS/Python.
          </p>
        </section>



        <div className="mt-8 flex gap-3">
          <Link
            href={`/assessment/${interviewId}`}
            className="rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white hover:bg-slate-700"
          >
            Back to Assessment
          </Link>
          <Link href="/" className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

