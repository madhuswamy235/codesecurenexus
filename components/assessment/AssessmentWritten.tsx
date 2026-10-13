"use client";

import { useState } from "react";
import { CheckCircle, FileText, Save } from "lucide-react";
import api from "@/lib/api";

type WrittenQuestion = { _id: string; text: string; maxScore?: number };

export default function AssessmentWritten({
  interviewId,
  questions,
  initial = {},
}: { interviewId: string; questions: WrittenQuestion[]; initial?: Record<string, string> }) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  if (!questions.length) return <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">No written questions in this interview.</div>;

  const question = questions[current];
  const answer = answers[question._id] || "";
  async function save(submit = false) {
    if (!answer.trim()) { setMessage("Write an answer before saving."); return; }
    setSaving(!submit); setSubmitting(submit); setMessage("");
    try {
      const path = submit ? "/assessments/written/submit" : "/assessments/written/save";
      await api.post(path, { interviewId, questionId: question._id, answerText: answer });
      setMessage(submit ? "Written answer submitted." : "Draft saved.");
      if (submit) setSubmitted((prev) => ({ ...prev, [question._id]: true }));
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Could not save written answer."); }
    finally { setSaving(false); setSubmitting(false); }
  }

  return <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><FileText className="text-violet-400" size={28} /><h2 className="text-xl font-bold">Written Assessment</h2></div><span className="text-sm text-slate-400">Question {current + 1}/{questions.length}</span></div>
    {questions.length > 1 && <div className="mt-4 flex gap-2">{questions.map((item, index) => <button key={item._id} onClick={() => setCurrent(index)} className={`rounded-lg px-3 py-1 text-xs ${index === current ? "bg-violet-600" : "bg-slate-800"}`}>#{index + 1}</button>)}</div>}
    <div className="mt-5 rounded-2xl bg-black/30 p-5"><h3 className="font-semibold">{question.text}</h3><p className="mt-1 text-xs text-slate-500">Explain your answer clearly and include examples where useful.</p></div>
    <textarea value={answer} onChange={(event) => setAnswers((prev) => ({ ...prev, [question._id]: event.target.value }))} placeholder="Type your answer here..." className="mt-4 min-h-52 w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-white outline-none focus:border-violet-400" />
    {message && <p className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-200">{message}</p>}
    <div className="mt-4 flex flex-wrap justify-between gap-3"><button onClick={() => setCurrent((index) => Math.max(0, index - 1))} disabled={current === 0} className="rounded-xl bg-white/10 px-5 py-3 disabled:opacity-40">Previous</button><div className="flex gap-3"><button onClick={() => save(false)} disabled={saving || submitting} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 disabled:opacity-50"><Save size={18} /> Save draft</button><button onClick={() => save(true)} disabled={submitting || submitted[question._id]} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 disabled:opacity-50"><CheckCircle size={18} /> {submitted[question._id] ? "Submitted" : "Submit"}</button></div><button onClick={() => setCurrent((index) => Math.min(questions.length - 1, index + 1))} disabled={current === questions.length - 1} className="rounded-xl bg-white/10 px-5 py-3 disabled:opacity-40">Next</button></div>
  </div>;
}
