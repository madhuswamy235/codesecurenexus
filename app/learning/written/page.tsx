"use client";

import { useState } from "react";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";

const prompts = [
  "Explain how you would design a URL shortener for one million daily users.",
  "Describe a difficult bug you solved and how you validated the fix.",
];

export default function LearningWrittenPage() {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);

  function nextPrompt() {
    setIndex((current) => (current + 1) % prompts.length);
    setAnswer("");
    setSaved(false);
  }

  return <ProtectedWorkspace eyebrow="Written practice"><div className="mx-auto max-w-3xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Practice mode</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Written Assessment</h1><p className="mt-2 text-slate-600">Practice structured answers and get comfortable explaining your thinking clearly.</p></div><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between text-sm text-slate-500"><span>Prompt {index + 1} of {prompts.length}</span><span>{answer.trim().length} characters</span></div><h2 className="mt-5 text-xl font-bold text-slate-900">{prompts[index]}</h2><textarea value={answer} onChange={(event) => { setAnswer(event.target.value); setSaved(false); }} placeholder="Write your answer here..." className="mt-6 min-h-64 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><div className="mt-4 flex flex-wrap justify-between gap-3"><button type="button" onClick={() => setSaved(true)} className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500">{saved ? "Draft saved" : "Save draft"}</button><button type="button" onClick={nextPrompt} className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700">Next prompt</button></div></section></div></ProtectedWorkspace>;
}
