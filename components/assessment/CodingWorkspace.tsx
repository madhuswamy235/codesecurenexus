/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Play,
  Save,
  CheckCircle,
  Wand2,
  Trash2,
  Pencil,
  Eraser,
  Square,
  Circle,
  Layers,
} from "lucide-react";
import api from "@/lib/api";
import { generateSchematicOps } from "@/lib/codeSchematic";
import type { SchematicOp } from "@/lib/codeSchematic";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

/**
 * CodingWorkspace - the COMBINED coding workspace for secure assessments.
 *
 * ONE workspace containing:
 *  - A professional Monaco live code editor (real @monaco-editor/react).
 *  - Run / Save / Submit against the existing backend endpoints
 *    (/assessments/code/run|save|submit - DEV_EXECUTOR, JS/Python real runs).
 *  - A TWO-IN-ONE whiteboard: the candidate can manually draw (pen, eraser,
 *    rectangles, ellipses, colors) on the SAME canvas where the automatic
 *    code -> schematic layer ("sc_*" ops) is drawn. The schematic is
 *    generated from the REAL code in the editor via lib/codeSchematic.
 *  - Schematic layer and manual layer coexist; Clear Schematic removes only
 *    generated objects, never manual strokes.
 *  - Whiteboard ops persist via the existing REST contract
 *    (GET/PUT /api/whiteboard/:interviewId).
 *
 * Lockdown is handled page-wide by useAssessmentLockdown (see AssessmentRunner);
 * this component does not re-implement it.
 */

export interface CodingQuestion {
  _id: string;
  text: string;
  language?: string;
  starterCode?: string;
  maxScore?: number;
}

export interface EvaluatedResult {
  score?: number;
  passed?: number;
  total?: number;
  submitted?: boolean;
  testResults?: { input: string; expected: string; actual: string; passed: boolean; error?: string }[];
}

const LANGS: { label: string; value: string }[] = [
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
];

const STARTERS: Record<string, string> = {
  javascript: 'console.log("Hello World");',
  python: 'print("Hello World")',
  java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"SecureNexus\");\n    }\n}",
  c: "#include <stdio.h>\nint main() {\n    printf(\"SecureNexus\\n\");\n    return 0;\n}",
  cpp: "#include <iostream>\nint main() {\n    std::cout << \"SecureNexus\" << std::endl;\n    return 0;\n}",
};

function supportedLang(l: string | undefined): boolean {
  const x = String(l || "").toLowerCase();
  return ["javascript", "node", "js", "python", "python3", "py", "java", "c", "cpp"].includes(x);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface WbPoint { x: number; y: number; }
interface WbOp {
  id: string;
  type: "stroke" | "shape" | "text";
  tool?: string;
  points?: WbPoint[];
  color?: string;
  size?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: boolean;
  text?: string;
}

export default function CodingWorkspace({
  interviewId,
  question,
  initialCode,
  initialLang,
  onEvaluated,
  onCodeChange,
  onLangChange,
  room,
}: {
  interviewId: string;
  question: CodingQuestion;
  initialCode?: string;
  initialLang?: string;
  onEvaluated?: (r: EvaluatedResult) => void;
  /** Mirrors every editor keystroke up to the parent (so multi-question
   *  navigation never loses typed code). */
  onCodeChange?: (code: string) => void;
  /** Mirrors language switches up to the parent. */
  onLangChange?: (lang: string) => void;
  room?: InterviewRoomController;
}) {
  const [language, setLanguage] = useState(
    initialLang && supportedLang(initialLang) ? initialLang : "javascript"
  );
  const [code, setCode] = useState(initialCode || STARTERS[initialLang || "javascript"] || "");
  const [output, setOutput] = useState("");
  const [runInfo, setRunInfo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  /* ---- dual-layer whiteboard ---- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ops, setOps] = useState<WbOp[]>([]);
  const opsRef = useRef<WbOp[]>([]);
  const drawingRef = useRef(false);

  const [tool, setTool] = useState<"pen" | "eraser" | "rect" | "ellipse">("pen");
  const [color, setColor] = useState("#00ffcc");
  const [size, setSize] = useState(3);
  const [wbMsg, setWbMsg] = useState("");
  const [schematicCount, setSchematicCount] = useState(0);
  const shapeStartRef = useRef<WbPoint | null>(null);
  const currentStrokeRef = useRef<WbPoint[]>([]);
  const persistTimerRef = useRef<number | null>(null);

  /* ---------- whiteboard persistence (existing REST contract) ---------- */
  const persistOps = useCallback(
    (next: WbOp[]) => {
      if (!interviewId) return;
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(async () => {
        try {
          await api.put(`/whiteboard/${interviewId}`, {
            strokes: [],
            ops: next,
          } as Record<string, unknown>);
        } catch {
          /* persistence is best-effort */
        }
      }, 450);
    },
    [interviewId]
  );
/* ---------- canvas helpers ---------- */
  function getCtx() {
    const c = canvasRef.current;
    return c ? c.getContext("2d") : null;
  }

  function drawOp(ctx: CanvasRenderingContext2D, op: WbOp) {
    ctx.save();
    ctx.strokeStyle = op.color || "#00ffcc";
    ctx.fillStyle = op.color || "#00ffcc";
    ctx.lineWidth = op.size || 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (op.type === "stroke" && op.points && op.points.length) {
      ctx.beginPath();
      ctx.moveTo(op.points[0].x, op.points[0].y);
      for (let i = 1; i < op.points.length; i++) ctx.lineTo(op.points[i].x, op.points[i].y);
      ctx.stroke();
    } else if (op.type === "shape" && op.tool === "rect") {
      ctx.beginPath();
      ctx.rect(op.x || 0, op.y || 0, op.w || 0, op.h || 0);
      if (op.fill) ctx.fill();
      ctx.stroke();
    } else if (op.type === "shape" && op.tool === "ellipse") {
      const cx = (op.x || 0) + (op.w || 0) / 2;
      const cy = (op.y || 0) + (op.h || 0) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(op.w || 0) / 2, Math.abs(op.h || 0) / 2, 0, 0, Math.PI * 2);
      if (op.fill) ctx.fill();
      ctx.stroke();
    } else if (op.type === "text") {
      ctx.font = `${op.size || 14}px sans-serif`;
      ctx.fillText(op.text || "", op.x || 0, op.y || 0);
    }
    ctx.restore();
  }

  function redrawAll(list: WbOp[]) {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    for (const op of list) drawOp(ctx, op);
  }

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (parent) {
      c.width = parent.clientWidth;
      c.height = parent.clientHeight;
    }
    redrawAll(opsRef.current);
  }, []);

  /* ---------- restore persisted whiteboard ops on mount ---------- */
  useEffect(() => {
    let cancelled = false;
    if (!interviewId) return;
    api
      .get<{ ops: WbOp[] }>(`/whiteboard/${interviewId}`)
      .then((res) => {
        if (cancelled) return;
        const existing = Array.isArray(res.data?.ops) ? res.data!.ops : [];
        opsRef.current = existing;
        setOps(existing);
        setSchematicCount(existing.filter((o) => o.id.startsWith("sc_")).length);
        setWbMsg(existing.length ? "Whiteboard restored from backend." : "");
        if (canvasRef.current) redrawAll(existing);
      })
      .catch(() => {
        /* no saved board yet - fine */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  /* ---------- redraw when ops change ---------- */
  useEffect(() => {
    redrawAll(ops);
  }, [ops]);

  /* ---------- auto refresh the schematic when the editor code changes ----------
   * Debounced so typing settles first. Only the generated "sc_*" layer is
   * replaced -- manually drawn strokes/shapes are never destroyed.
   */
  useEffect(() => {
    const t = window.setTimeout(() => {
      generateDiagram(true);
    }, 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
/* ---------- op state helpers ---------- */
  function commitOps(next: WbOp[]) {
    opsRef.current = next;
    setOps(next);
    persistOps(next);
  }

  function addOp(op: WbOp) {
    commitOps([...opsRef.current, op]);
  }

  /* ---------- schematic: generate from the REAL editor code ---------- */
  function generateDiagram(silent = false) {
    const c = canvasRef.current;
    const width = c ? c.width : 860;
    const height = c ? c.height : 520;
    const scOps: WbOp[] = generateSchematicOps(code, { width, height }) as WbOp[];
    const current = room ? ((room.whiteboardOps as WbOp[]) || []) : opsRef.current;
    const manual = current.filter((o) => !o.id.startsWith("sc_"));
    const next = [...manual, ...scOps];
    if (room) {
      const removed = current
        .filter((o) => o.id.startsWith("sc_"))
        .map((o) => ({ id: o.id, type: "delete", target: o.id }));
      room.emitWhiteboardOps([...removed, ...scOps]);
    }
    commitOps(next);
    setSchematicCount(scOps.length);
    if (!silent) {
      setWbMsg("Code schematic generated from your editor code. Manual drawing stays intact.");
    }
    if (canvasRef.current) redrawAll(next);
  }

  function clearSchematic() {
    const current = room ? ((room.whiteboardOps as WbOp[]) || []) : opsRef.current;
    const generated = current.filter((o) => o.id.startsWith("sc_"));
    const next = current.filter((o) => !o.id.startsWith("sc_"));
    if (room) {
      room.emitWhiteboardOps(generated.map((o) => ({ id: o.id, type: "delete", target: o.id })));
    }
    commitOps(next);
    setSchematicCount(0);
    setWbMsg("Schematic layer cleared. Manual strokes kept.");
    if (canvasRef.current) redrawAll(next);
  }

  function clearBoard() {
    commitOps([]);
    setSchematicCount(0);
    setWbMsg("Whiteboard cleared.");
    if (canvasRef.current) redrawAll([]);
  }

  /* ---------- pointer handlers (pen / eraser / shapes) ---------- */
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawingRef.current = true;
    currentStrokeRef.current = [{ x, y }];
    shapeStartRef.current = { x, y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = getCtx();
    const c = canvasRef.current;
    if (!ctx || !c) return;

    if (tool === "rect" || tool === "ellipse") {
      /* live preview of the shape being dragged */
      redrawAll(opsRef.current);
      const start = shapeStartRef.current;
      if (!start) return;
      const w = x - start.x;
      const h = y - start.y;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = size;
      if (tool === "rect") {
        ctx.strokeRect(Math.min(start.x, x), Math.min(start.y, y), Math.abs(w), Math.abs(h));
      } else {
        ctx.beginPath();
        const cx = (start.x + x) / 2;
        const cy = (start.y + y) / 2;
        ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      currentStrokeRef.current.push({ x, y });
      ctx.strokeStyle = tool === "eraser" ? "#0f172a" : color;
      ctx.lineWidth = tool === "eraser" ? size * 4 : size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(currentStrokeRef.current[currentStrokeRef.current.length - 2].x,
                 currentStrokeRef.current[currentStrokeRef.current.length - 2].y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const start = shapeStartRef.current;
    if ((tool === "rect" || tool === "ellipse") && start) {
      if (Math.abs(x - start.x) > 3 || Math.abs(y - start.y) > 3) {
        addOp({
          id: makeId("wb"),
          type: "shape",
          tool,
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          w: Math.abs(x - start.x),
          h: Math.abs(y - start.y),
          color,
          size,
          fill: false,
        });
      }
    } else if (currentStrokeRef.current.length > 1) {
      addOp({
        id: makeId("wb"),
        type: "stroke",
        tool: tool === "eraser" ? "eraser" : "pen",
        points: currentStrokeRef.current,
        color: tool === "eraser" ? "#0f172a" : color,
        size: tool === "eraser" ? size * 4 : size,
      });
    }
    currentStrokeRef.current = [];
    shapeStartRef.current = null;
  }
/* ---------- Run / Save / Submit (existing backend endpoints) ---------- */
  function actualLang() {
    const l = language || question.language || "javascript";
    return supportedLang(l) ? l : "javascript";
  }

  async function saveDraft() {
    if (!interviewId || !question._id) {
      setMsg("Save requires a CODING question assigned to this interview.");
      return;
    }
    setBusy("save");
    setMsg("");
    try {
      await api.post("/assessments/code/save", {
        interviewId,
        questionId: question._id,
        language: actualLang(),
        code: code || question.starterCode || "",
      });
      setMsg("Code draft saved.");
      setTimeout(() => setMsg(""), 2500);
    } catch (err: any) {
      setMsg(err?.message || "Save failed.");
    } finally {
      setBusy("");
    }
  }

  async function run() {
    setBusy("run");
    setMsg("");
    setOutput("");
    setRunInfo("");
    try {
      const res = await api.post<{ output?: string; executionMode?: string }>("/assessments/code/run", {
        language: actualLang(),
        code: code || question.starterCode || "",
      });
      setOutput(res.data?.output || "");
      setRunInfo(
        `Executed by ${res.data?.executionMode || "DEV_EXECUTOR"} — real execution for supported languages.`
      );
    } catch (err: any) {
      setOutput("");
      setRunInfo("Run failed. Check language support (JS/Python in dev executor).");
      setMsg(err?.message || "Run failed.");
    } finally {
      setBusy("");
    }
  }

  async function submit() {
    if (!code?.trim() && !question.starterCode) {
      setMsg("Write some code before submitting.");
      return;
    }
    setBusy("submit");
    setMsg("");
    try {
      const res = await api.post<{ submission: any; score: number; testsPassed: number; testsTotal: number; testResults?: EvaluatedResult["testResults"] }>(
        "/assessments/code/submit",
        {
          interviewId,
          questionId: question._id,
          language: actualLang(),
          code: code || question.starterCode,
        }
      );
      const r = {
        score: res.data!.score ?? 0,
        passed: res.data!.testsPassed ?? 0,
        total: res.data!.testsTotal ?? 0,
        submitted: true,
        testResults: res.data!.testResults || [],
      };
      onEvaluated?.(r);
      if (r.total === 0) {
        setMsg(
          "Code submitted. This question has no test-case data on the backend to grade, so nothing was evaluated."
        );
      } else if (r.passed === r.total) {
        setMsg(`Code submitted. All ${r.total}/${r.total} test cases passed · score ${r.score}.`);
      } else {
        setMsg(`Code submitted. ${r.passed}/${r.total} tests passed · score ${r.score}.`);
      }
      setTimeout(() => setMsg(""), 4000);
    } catch (err: any) {
      setMsg(err?.message || "Submit failed.");
    } finally {
      setBusy("");
    }
  }

  function changeLang(value: string) {
    setLanguage(value);
    setCode(STARTERS[value] || "");
    setOutput("");
    setRunInfo("");
    onLangChange?.(value);
    onCodeChange?.(STARTERS[value] || "");
  }
return (
    <div className="space-y-6">
      {/* ------- Live Code Editor (Monaco) ------- */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-cyan-400">Live Coding Workspace</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={actualLang()}
              onChange={(e) => changeLang(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white outline-none focus:border-cyan-500"
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              onClick={run}
              disabled={busy === "run"}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Play size={18} /> {busy === "run" ? "Running..." : "Run"}
            </button>
            <button
              onClick={saveDraft}
              disabled={busy === "save"}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              <Save size={18} /> {busy === "save" ? "Saving..." : "Save Draft"}
            </button>
            <button
              onClick={submit}
              disabled={busy === "submit"}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle size={18} /> {busy === "submit" ? "Submitting..." : "Submit Code"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
          <Editor
            height="320px"
            defaultLanguage={actualLang()}
            language={actualLang()}
            value={code}
            onChange={(value) => {
              setCode(value || "");
              onCodeChange?.(value || "");
            }}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
              tabSize: 2,
              contextmenu: false,
            }}
          />
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          DEV EXECUTOR (backend): real execution for JavaScript/Python. Java/C/C++
          return the backend&apos;s honest unsupported-language message.
        </p>
        {runInfo && <p className="mt-2 text-xs text-slate-400">{runInfo}</p>}
        {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
        {output !== "" && (
          <div className="mt-3 rounded-lg bg-black/40 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Output</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-slate-200">{output}</pre>
          </div>
        )}
      </div>
{/* ------- TWO-IN-ONE Whiteboard: manual drawing + code schematic ------- */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="text-purple-400" size={22} />
            <h3 className="text-lg font-bold text-purple-300">Whiteboard · Draw + Code Schematic</h3>
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-300">
            {schematicCount > 0 ? `${schematicCount} schematic objects` : "no schematic"}
          </span>
        </div>

        {wbMsg && <p className="mt-2 text-xs text-cyan-300">{wbMsg}</p>}

        {/* toolbar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTool("pen")}
            title="Pen"
            className={`rounded-lg p-2 ${tool === "pen" ? "bg-cyan-500 text-black" : "bg-slate-800 text-white hover:bg-slate-700"}`}
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setTool("eraser")}
            title="Eraser"
            className={`rounded-lg p-2 ${tool === "eraser" ? "bg-cyan-500 text-black" : "bg-slate-800 text-white hover:bg-slate-700"}`}
          >
            <Eraser size={18} />
          </button>
          <button
            onClick={() => setTool("rect")}
            title="Rectangle"
            className={`rounded-lg p-2 ${tool === "rect" ? "bg-cyan-500 text-black" : "bg-slate-800 text-white hover:bg-slate-700"}`}
          >
            <Square size={18} />
          </button>
          <button
            onClick={() => setTool("ellipse")}
            title="Ellipse"
            className={`rounded-lg p-2 ${tool === "ellipse" ? "bg-cyan-500 text-black" : "bg-slate-800 text-white hover:bg-slate-700"}`}
          >
            <Circle size={18} />
          </button>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Stroke color"
            className="h-9 w-9 cursor-pointer rounded bg-transparent"
          />
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-24"
            title="Stroke size"
          />
          <div className="mx-1 h-6 w-px bg-white/10" />
          <button
            onClick={() => generateDiagram()}
            title="Generate schematic from editor code"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
          >
            <Wand2 size={16} /> Generate Schematic
          </button>
          <button
            onClick={clearSchematic}
            title="Clear schematic layer (keeps manual drawing)"
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
          >
            Clear Schematic
          </button>
          <button
            onClick={clearBoard}
            title="Clear entire board"
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            <Trash2 size={16} /> Clear All
          </button>
        </div>
{/* canvas */}
        <div className="relative mt-3 h-[420px] overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-900">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          />
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Draw freely with pen/eraser/shapes — the generated code schematic coexists on this
          same canvas as ordinary whiteboard layers, so you can annotate the architecture.
        </p>
      </div>
    </div>
  );
}