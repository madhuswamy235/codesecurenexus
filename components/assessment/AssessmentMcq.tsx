/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useState } from "react";
import { Brain, ChevronLeft, ChevronRight, CheckCircle, Save } from "lucide-react";
import api from "@/lib/api";

/**
 * AssessmentMcq — REAL MCQ assessment connected to the backend.
 * Loads questions, restores saved selections after refresh, and saves/submits
 * against the real /assessments/mcq/* endpoints. Marks are genuinely computed.
 */

export interface McqQuestion {
  _id: string;
  text: string;
  options: string[];
  maxScore?: number;
  correctOption?: number;
}

export default function AssessmentMcq({
  interviewId,
  questions,
  initial,
  fallbackMode = false,
}: {
  interviewId: string;
  questions: McqQuestion[];
  initial?: Record<string, number>;
  fallbackMode?: boolean;
}) {
  const [selections, setSelections] = useState<Record<string, number>>(initial || {});
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<{ total: number; maxTotal: number; percentage: number } | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const q = questions[current];
  const answeredCount = questions.filter((qq) => selections[qq._id] !== undefined).length;

  async function saveCurrent(): Promise<boolean> {
    if (!q || selections[q._id] === undefined) {
      setMsg("Select an option first.");
      return false;
    }
    setSaving(true);
    setMsg("");
    if (fallbackMode) {
      setMsg("Answer saved in demo mode.");
      setSaving(false);
      return true;
    }
    try {
      await api.post("/assessments/mcq/save", {
        interviewId,
        questionId: q._id,
        selectedOption: selections[q._id],
      });
      setMsg("Answer saved.");
      setTimeout(() => setMsg(""), 2000);
      return true;
    } catch (err: any) {
      setMsg(err.message || "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function nextQuestion() {
    if (!(await saveCurrent())) return;
    setCurrent((c) => Math.min(questions.length - 1, c + 1));
  }

  function selectOption(idx: number) {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[q._id] === idx) delete next[q._id];
      else next[q._id] = idx;
      return next;
    });
  }

  async function submit() {
    if (questions.length === 0) return;
    setSubmitting(true);
    setMsg("");
    if (fallbackMode) {
      const total = questions.reduce(
        (score, question) => score + (selections[question._id] === question.correctOption ? 1 : 0),
        0
      );
      setResult({ total, maxTotal: questions.length, percentage: Math.round((total / questions.length) * 100) });
      setAlreadySubmitted(true);
      setMsg("MCQ demo submitted.");
      setSubmitting(false);
      return;
    }
    try {
      const answers = questions
        .filter((qq) => selections[qq._id] !== undefined)
        .map((qq) => ({ questionId: qq._id, selectedOption: selections[qq._id] }));
      const res = await api.post<{ aggregate: any }>("/assessments/mcq/submit", {
        interviewId,
        answers,
      });
      setResult(res.data!.aggregate);
      setAlreadySubmitted(true);
      setMsg("MCQ section submitted.");
    } catch (err: any) {
      setMsg(err.message || "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
        No MCQ questions in this interview.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="text-green-400" size={28} />
          <h2 className="text-xl font-bold text-white">MCQ Assessment</h2>
        </div>
        <div className="text-sm text-green-400">
          Answered {answeredCount}/{questions.length}
        </div>
      </div>

      {msg && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
          {msg}
        </div>
      )}

      <div className="mt-6">
        <div className="rounded-2xl bg-black/30 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Question {current + 1} of {questions.length}
          </p>
          <h3 className="mt-2 font-semibold text-white">{q.text}</h3>
        </div>

        <div className="mt-4 space-y-3">
          {q.options.map((option: string, idx: number) => {
            const selected = selections[q._id] === idx;
            return (
              <button
                key={idx}
                onClick={() => selectOption(idx)}
                className={`w-full rounded-xl border p-4 text-left text-white ${
                  selected ? "border-green-400 bg-green-500/20" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="mr-2 font-mono text-sm text-slate-400">
                  {String.fromCharCode(65 + idx)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>
      </div>


      <div className="mt-8 flex justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-white disabled:opacity-40"
        >
          <ChevronLeft size={20} /> Previous
        </button>

        <button
          onClick={saveCurrent}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-white disabled:opacity-60"
        >
          <Save size={18} /> {saving ? "Saving..." : "Save"}
        </button>

        {current < questions.length - 1 ? (
          <button
            onClick={nextQuestion}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-white"
          >
            Next <ChevronRight size={20} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={submitting || alreadySubmitted}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-white disabled:opacity-60"
          >
            <CheckCircle size={20} /> {submitting ? "Submitting..." : alreadySubmitted ? "Submitted" : "Submit"}
          </button>
        )}
      </div>

      {result && (
        <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center">
          <CheckCircle className="mx-auto text-green-400" size={40} />
          <h3 className="mt-3 text-xl font-bold text-white">MCQ Section Completed</h3>
          <p className="mt-2 text-green-400">
            Score: {result.total}/{result.maxTotal} ({result.percentage}%)
          </p>
        </div>
      )}
    </div>
  );
}

