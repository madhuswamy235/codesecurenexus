/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useState } from "react";
import { Play, Save, Download } from "lucide-react";
import Editor from "@monaco-editor/react";
import api from "@/lib/api";
import { generateSchematicOps } from "@/lib/codeSchematic";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * Live Coding Workspace
 *
 * Wired to the existing Phase 2 backend contract (unchanged):
 *  - Run   -> POST /api/assessments/code/run    (real DEV_EXECUTOR, JS/Python)
 *  - Save  -> POST /api/assessments/code/save   (persists a draft, requires a
 *             CODING question assigned to the interview)
 *  - Export-> downloads the current code as a source file
 *  - Drafts are restored from GET /api/submissions?interviewId= on mount.
 * Languages the dev executor cannot run return the backend's honest
 * "not supported" message — the button is never silently dead.
 */

interface SavedCodingRow {
  type?: string;
  questionId?: string;
  language?: string;
  code?: string;
}

const LANGS: { label: string; value: string; ext: string }[] = [
  { label: "JavaScript", value: "javascript", ext: "js" },
  { label: "Python", value: "python", ext: "py" },
  { label: "Java", value: "java", ext: "java" },
  { label: "C", value: "c", ext: "c" },
  { label: "C++", value: "cpp", ext: "cpp" },
];

const STARTERS: Record<string, string> = {
  javascript: `console.log("SecureNexus");`,
  python: `print("SecureNexus")`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("SecureNexus");\n    }\n}`,
  c: `#include <stdio.h>\nint main() {\n    printf("SecureNexus\\n");\n    return 0;\n}`,
  cpp: `#include <iostream>\nint main() {\n    std::cout << "SecureNexus" << std::endl;\n    return 0;\n}`,
};

export default function LiveCodeEditor({
  interviewId,
  room,
}: {
  interviewId?: string;
  room: InterviewRoomController;
}) {
  const codingQ = (room.questions || []).find((q: any) => q.type === "CODING");
  const questionId = codingQ?._id as string | undefined;

  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(STARTERS.javascript);
  const [output, setOutput] = useState("");
  const [runInfo, setRunInfo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  /* Keep generated code structure in the shared whiteboard layer. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = (room.whiteboardOps || []) as Array<{ id: string }>;
      const generated = generateSchematicOps(code, { width: 860, height: 360 });
      const removed = current
        .filter((op) => op.id.startsWith("sc_"))
        .map((op) => ({ id: op.id, type: "delete", target: op.id }));
      room.emitWhiteboardOps([...removed, ...generated]);
    }, 1600);
    return () => window.clearTimeout(timer);
    // The emitter is stable; the controller object is recreated by room state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, interviewId, room.emitWhiteboardOps]);

  /* ----- restore saved draft (CODING submission for this interview) ----- */
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    api
      .get<SavedCodingRow[]>(`/submissions?interviewId=${interviewId}`)
      .then((res) => {
        if (cancelled) return;
        const rows = (res.data || []) as SavedCodingRow[];
        const mine = rows.find(
          (r) => r.type === "CODING" && (!questionId || r.questionId === questionId)
        );
        if (mine) {
          if (mine.code) setCode(mine.code);
          if (mine.language && STARTERS[mine.language]) setLanguage(mine.language);
          setRunInfo("Restored saved draft from the backend.");
        }
      })
      .catch(() => {
        /* no draft yet — fine */
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId, questionId]);

  function changeLang(value: string) {
    setLanguage(value);
    setCode(STARTERS[value] || "");
    setOutput("");
    setRunInfo("");
  }

  async function run() {
    setBusy("run");
    setMsg("");
    setOutput("");
    setRunInfo("");
    try {
      const res = await api.post<{ output?: string; executionMode?: string; error?: string }>(
        "/assessments/code/run",
        { language, code }
      );
      setOutput(res.data?.output || "");
      setRunInfo(
        res.data?.executionMode
          ? `Executed by ${res.data.executionMode} — real execution for supported languages.`
          : "Executed by the backend."
      );
    } catch (err: any) {
      setOutput("");
      setRunInfo(err?.message || "Run failed. Check the backend / code execution service.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!interviewId || !questionId) {
      setMsg("Save requires a CODING question assigned to this interview.");
      return;
    }
    setBusy("save");
    setMsg("");
    try {
      await api.post("/assessments/code/save", {
        interviewId,
        questionId,
        language,
        code,
      });
      setMsg("Code draft saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch (err: any) {
      setMsg(err?.message || "Save failed.");
    } finally {
      setBusy("");
    }
  }

  function exportCode() {
    const meta = LANGS.find((l) => l.value === language) || LANGS[0];
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solution.${meta.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-cyan-400 mb-4">
        Live Coding Workspace
      </h2>

      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <select
          value={language}
          onChange={(e) => changeLang(e.target.value)}
          className="bg-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-cyan-500 border border-slate-700"
        >
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="flex gap-3">
          <button
            onClick={run}
            disabled={busy === "run"}
            className="bg-green-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-60"
          >
            <Play size={18} /> {busy === "run" ? "Running…" : "Run"}
          </button>
          <button
            onClick={save}
            disabled={busy === "save"}
            className="bg-cyan-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-cyan-700 disabled:opacity-60"
          >
            <Save size={18} /> {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button
            onClick={exportCode}
            className="bg-yellow-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-700"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-700">
        <Editor
          height="420px"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={(value) => setCode(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>

      {runInfo && <p className="mt-3 text-xs text-slate-400">{runInfo}</p>}
      {msg && <p className="mt-2 text-sm text-emerald-400">{msg}</p>}

      <div className="mt-4 bg-black rounded-lg p-4 border border-gray-700">
        <h3 className="font-bold text-green-400">Output</h3>
        <pre className="text-gray-300 mt-2 whitespace-pre-wrap font-mono text-sm">
          {output || "Program output will appear here…"}
        </pre>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        DEV EXECUTOR (backend): real execution for JavaScript/Python. Java/C/C++
        return the backend&apos;s honest unsupported-language message.
      </p>
    </div>
  );
}
