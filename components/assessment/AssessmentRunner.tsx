/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import { useAssessmentLockdown } from "@/hooks/useAssessmentLockdown";
import AssessmentMcq from "./AssessmentMcq";
import AssessmentCoding from "./AssessmentCoding";
import AssessmentWritten from "./AssessmentWritten";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * AssessmentRunner — drives the REAL candidate assessment workflow.
 *  - Loads the interview + session (restoring an active session after refresh).
 *  - Loads questions + previously saved answers (restore after refresh).
 *  - Renders MCQ and Coding sections connected to the backend.
 *  - Final submit combines all evaluated sections (duplicate-safe) + confirmation.
 */

type Tab = "mcq" | "coding" | "written";

const DEMO_MCQ = [{
  _id: "demo-mcq-1",
  text: "What does const sum = a + b calculate?",
  options: ["The total of a and b", "The difference between a and b", "A text string", "Nothing"],
  correctOption: 0,
  maxScore: 1,
}];

export default function AssessmentRunner({
  interviewId,
  room,
}: {
  interviewId: string;
  room?: InterviewRoomController;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<{ MCQ: any[]; CODING: any[]; WRITTEN: any[] }>({
    MCQ: [],
    CODING: [],
    WRITTEN: [],
  });
  const [mcqInitial, setMcqInitial] = useState<Record<string, number>>({});
  const [codeInitial, setCodeInitial] = useState<Record<string, string>>({});
  const [langInitial, setLangInitial] = useState<Record<string, string>>({});
  const [writtenInitial, setWrittenInitial] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("mcq");
  const [submitting, setSubmitting] = useState(false);
  const [finalMsg, setFinalMsg] = useState("");
  const [finalResult, setFinalResult] = useState<any>(null);
  const [demoFallback, setDemoFallback] = useState(false);

  /* Assessment lockdown: this page is the REAL (proctored) test-taking
   * surface. While active, copy/cut/paste, shortcuts and the context menu are
   * blocked on the assessment areas and security events (tab switch/window
   * blur) are logged to the backend. Nothing here is mounted globally, so
   * normal copy/paste keeps working everywhere else in the app. */
  const { active: lockdown } = useAssessmentLockdown({ interviewId, enabled: true });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sessRes, qRes, subRes] = await Promise.all([
          api.get(`/interviews/${interviewId}/session`),
          api.get(`/questions?interviewId=${interviewId}`),
          api.get(`/submissions?interviewId=${interviewId}`),
        ]);
        if (cancelled) return;

        const iv = sessRes.data as any;
        setInterview(iv.interview);
        let s = iv.session;
        // Restore valid session: if pending, start it (active).
        if (s && s.status === "pending") {
          const startRes = await api.post<{ session?: any }>(`/interviews/${interviewId}/start`, {
            timerSeconds: (iv.interview?.durationMinutes || 60) * 60,
          });
          const startData = startRes.data as { session?: any } | undefined;
          s = startData?.session || s;
        }
        setSession(s);

        const rows = Array.isArray(qRes.data) ? (qRes.data as any[]) : [];
        const grouped = {
          MCQ: rows.filter((r) => r.type === "MCQ"),
          CODING: rows.filter((r) => r.type === "CODING"),
          WRITTEN: rows.filter((r) => r.type === "WRITTEN"),
        };
        if (!grouped.MCQ.length) {
          grouped.MCQ = DEMO_MCQ;
          setDemoFallback(true);
        } else {
          setDemoFallback(false);
        }
        setQuestions(grouped);

        const subs = Array.isArray(subRes.data) ? (subRes.data as any[]) : [];
        const mq: Record<string, number> = {};
        const ci: Record<string, string> = {};
        const li: Record<string, string> = {};
        const wi: Record<string, string> = {};
        for (const srow of subs) {
          if (srow.type === "MCQ" && srow.questionId && srow.selectedOption !== undefined && srow.selectedOption !== -1) {
            mq[srow.questionId] = srow.selectedOption;
          } else if (srow.type === "CODING" && srow.questionId) {
            if (srow.code) ci[srow.questionId] = srow.code;
            if (srow.language) li[srow.questionId] = srow.language;
          } else if (srow.type === "WRITTEN" && srow.questionId) {
            if (srow.answerText) wi[srow.questionId] = srow.answerText;
          }
        }
        setMcqInitial(mq);
        setCodeInitial(ci);
        setLangInitial(li);
        setWrittenInitial(wi);
      } catch {
        setDemoFallback(true);
        setQuestions({ MCQ: DEMO_MCQ, CODING: [], WRITTEN: [] });
        setInterview({ title: "MCQ Assessment Demo" });
        setSession({ status: "demo" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  async function finalSubmit() {
    if (demoFallback) {
      setFinalResult({ totalScore: 0, totalMax: questions.MCQ.length, overallPercentage: 0 });
      setFinalMsg("Demo assessment submitted locally.");
      return;
    }
    setSubmitting(true);
    setFinalMsg("");
    try {
      const res = await api.post<{ overallPercentage: number; totalScore: number; totalMax: number; submission: any }>(
        "/assessments/final/submit",
        { interviewId }
      );
      setFinalResult(res.data);
      setFinalMsg("Assessment submitted successfully.");
      router.push(`/assessment/${interviewId}/result`);
    } catch (err: any) {
      setFinalMsg(err.message || "Final submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "mcq", label: "MCQ", count: questions.MCQ.length },
    { key: "coding", label: "Coding", count: questions.CODING.length },
    { key: "written", label: "Written", count: questions.WRITTEN.length },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading assessment…
      </div>
    );
  }


  if (finalResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-xl rounded-3xl border border-green-500/30 bg-slate-900 p-8 text-center">
          <h1 className="text-3xl font-bold text-green-400">Assessment Submitted 🎉</h1>
          <p className="mt-2 text-slate-300">Your assessment has been recorded successfully.</p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-sm text-slate-400">Score</p>
              <p className="mt-1 text-2xl font-bold text-green-400">{finalResult.totalScore}/{finalResult.totalMax}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-sm text-slate-400">Percentage</p>
              <p className="mt-1 text-2xl font-bold text-cyan-400">{finalResult.overallPercentage}%</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="text-sm text-slate-400">Status</p>
              <p className="mt-1 text-2xl font-bold text-green-400">Submitted</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/assessment/${interviewId}/result`)}
            className="mt-8 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700"
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  const total = tabs.reduce((a, t) => a + t.count, 0);


  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">{interview?.title || "Assessment"}</h1>
            <p className="text-sm text-slate-400">
              Session: {session?.status || "..."} · {total} questions
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-300">
            Real backend · file storage
          </span>
        </div>

        {lockdown && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 p-4">
            <ShieldCheck className="text-amber-400" size={26} />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">
                Assessment Lockdown · AI assistance disabled
              </h2>
              <p className="mt-1 text-xs text-amber-200/90">
                External assistance prohibited · copy/cut/paste and the context menu are blocked in
                assessment areas · tab/window activity is monitored.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-5 py-3 font-semibold ${
                tab === t.key ? "bg-green-600" : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {tab === "mcq" && (
          <AssessmentMcq interviewId={interviewId} questions={questions.MCQ} initial={mcqInitial} fallbackMode={demoFallback} />
        )}
        {tab === "coding" && (
          <AssessmentCoding
            interviewId={interviewId}
            questions={questions.CODING}
            initialCode={codeInitial}
            initialLang={langInitial}
            room={room}
          />
        )}
        {tab === "written" && (
          <AssessmentWritten interviewId={interviewId} questions={questions.WRITTEN} initial={writtenInitial} />
        )}

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">Final Submission</h2>
          <p className="mt-1 text-sm text-slate-400">
             Combines your evaluated MCQ, coding, and written sections. Once submitted you cannot submit again.
          </p>
          {finalMsg && <p className="mt-3 text-sm text-green-300">{finalMsg}</p>}
          <button
            onClick={finalSubmit}
            disabled={submitting}
            className="mt-4 w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}
