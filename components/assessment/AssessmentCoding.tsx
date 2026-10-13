"use client";

import { useState } from "react";
import { Code2, CheckCircle } from "lucide-react";
import CodingWorkspace from "./CodingWorkspace";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * AssessmentCoding — REAL coding assessment connected to the backend.
 * Each coding question renders the combined CodingWorkspace (Monaco editor +
 * whiteboard + code→schematic). Run/Save/Submit live inside the workspace and
 * hit the existing /assessments/code/* endpoints (DEV_EXECUTOR, real
 * execution for JS/Python). Typed code/language are mirrored back so switching
 * questions never loses progress; drafts/answers restore after refresh.
 */

export interface CodingQuestion {
  _id: string;
  text: string;
  language?: string;
  starterCode?: string;
  maxScore?: number;
}

export default function AssessmentCoding({
  interviewId,
  questions,
  initialCode,
  initialLang,
  room,
}: {
  interviewId: string;
  questions: CodingQuestion[];
  initialCode?: Record<string, string>;
  initialLang?: Record<string, string>;
  room?: InterviewRoomController;
}) {
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState<Record<string, string>>(initialCode || {});
  const [lang, setLang] = useState<Record<string, string>>(initialLang || {});
  const [results, setResults] = useState<Record<string, {
    score?: number;
    passed?: number;
    total?: number;
    submitted?: boolean;
    testResults?: { input: string; expected: string; actual: string; passed: boolean; error?: string }[];
  }>>({});

  if (questions.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-400">
        No coding questions in this interview.
      </div>
    );
  }

  const q = questions[index];
  const res = results[q._id];

  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Code2 className="text-cyan-400" size={28} />
          <h2 className="text-xl font-bold text-white">Coding Assessment</h2>
        </div>
        <div className="text-sm text-slate-400">
          Problem {index + 1}/{questions.length}
        </div>
      </div>

      {questions.length > 1 && (
        <div className="mt-4 flex gap-2">
          {questions.map((qq, i) => (
            <button
              key={qq._id}
              onClick={() => setIndex(i)}
              className={`rounded-lg px-3 py-1 text-xs ${
                i === index ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              #{i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-black/30 p-5">
        <h3 className="font-semibold text-white">{q.text}</h3>
      </div>

      <CodingWorkspace
        key={q._id}
        interviewId={interviewId}
        question={q}
        initialCode={code[q._id] || q.starterCode || ""}
        initialLang={lang[q._id] || q.language}
        onCodeChange={(c) => setCode((prev) => ({ ...prev, [q._id]: c }))}
        onLangChange={(l) => setLang((prev) => ({ ...prev, [q._id]: l }))}
        room={room}
        onEvaluated={(r) =>
          setResults((prev) => ({ ...prev, [q._id]: { ...r, submitted: true } }))
        }
      />

      {res && (
        <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" size={28} />
            <h3 className="text-lg font-bold text-white">Coding Submission Evaluated</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-black/30 p-4">
              <p className="text-slate-400">Test Cases</p>
              <p className="mt-1 text-2xl font-bold text-green-400">{res.passed}/{res.total}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4">
              <p className="text-slate-400">Score</p>
              <p className="mt-1 text-2xl font-bold text-cyan-400">{res.score}</p>
            </div>
          </div>
          {res.testResults && res.testResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {res.testResults.map((test, testIndex) => (
                <div key={testIndex} className="rounded-lg bg-black/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Test case {testIndex + 1}</span>
                    <span className={test.passed ? "text-green-400" : "text-red-400"}>
                      {test.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    expected: {test.expected || "(empty)"} · actual: {test.actual || "(empty)"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

