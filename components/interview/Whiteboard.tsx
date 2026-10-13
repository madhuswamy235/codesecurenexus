/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Eraser,
  Square,
  Circle,
  Trash2,
  Download,
} from "lucide-react";
import api from "@/lib/api";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

interface WbPoint {
  x: number;
  y: number;
}
interface WbOp {
  id: string;
  type: "stroke" | "shape" | "text" | "move" | "modify" | "delete";
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
  target?: string;
  patch?: any;
  dx?: number;
  dy?: number;
}

const makeId = () =>
  `wb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Real-Time Whiteboard
 *
 * Wired to the existing Phase 3 backend contract:
 *  - join-room is handled by useInterviewRoom (single shared socket).
 *  - whiteboard:init restores persisted ops on (re)join.
 *  - whiteboard:op (remote) renders other participants' operations live.
 *  - drawing emits whiteboard:op; the server persists + rebroadcasts.
 *  - REST GET /api/whiteboard/:id restores ops on mount as a fallback.
 */
export default function Whiteboard({
  interviewId,
  room,
}: {
  interviewId?: string;
  room: InterviewRoomController;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<WbPoint[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser" | "rect" | "ellipse">(
    "pen"
  );
  const [color, setColor] = useState("#00ffcc");
  const [size, setSize] = useState(3);
  const [status, setStatus] = useState("connecting");

  /* ----- render helpers ----- */
  function getCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    return ctx;
  }

  function drawOp(ctx: CanvasRenderingContext2D, op: WbOp) {
    ctx.save();
    ctx.strokeStyle = op.color || "#00ffcc";
    ctx.fillStyle = op.color || "#00ffcc";
    ctx.lineWidth = op.size || 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (op.type === "stroke" && Array.isArray(op.points) && op.points.length) {
      ctx.beginPath();
      ctx.moveTo(op.points[0].x, op.points[0].y);
      for (let i = 1; i < op.points.length; i++) {
        ctx.lineTo(op.points[i].x, op.points[i].y);
      }
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
      ctx.font = `${op.size || 18}px sans-serif`;
      ctx.fillText(op.text || "", op.x || 0, op.y || 0);
    }
    ctx.restore();
  }

  /* ----- full re-render from ops list ----- */
  function redrawAll(ops: WbOp[]) {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const op of ops) {
      if (op.type === "delete") continue;
      drawOp(ctx, op);
    }
  }

  /* ----- keep canvas synced with the room's ops (init + remote + local) ----- */
  useEffect(() => {
    redrawAll((room.whiteboardOps as WbOp[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.whiteboardOps]);

  /* ----- REST restore fallback on mount (also fetches persisted ops) ----- */
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    api
      .get<{ ops?: WbOp[] }>(`/whiteboard/${interviewId}`)
      .then((res) => {
        if (cancelled) return;
        const ops = (res.data?.ops || []) as WbOp[];
        if (ops.length) redrawAll(ops);
        setStatus(ops.length ? "restored" : "ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  /* ----- pointer handlers ----- */
  function getPos(e: React.PointerEvent<HTMLCanvasElement>): WbPoint {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [getPos(e)];
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = getPos(e);
    currentStrokeRef.current.push(p);
    const ctx = getCtx();
    if (!ctx) return;
    const pts = currentStrokeRef.current;
    ctx.save();
    ctx.strokeStyle = tool === "eraser" ? "#0f172a" : color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = currentStrokeRef.current;
    currentStrokeRef.current = [];
    if (pts.length < 2) return;
    const op: WbOp = {
      id: makeId(),
      type: "stroke",
      tool: tool === "eraser" ? "eraser" : "pen",
      points: pts,
      color: tool === "eraser" ? "#0f172a" : color,
      size,
    };
    room.emitWhiteboardOp(op);
    setStatus("synced");
  }

  /* ----- clear: REST clear + local reset (socket ops stay authoritative) ----- */
  async function clearBoard() {
    if (interviewId) {
      try {
        await api.put(`/whiteboard/${interviewId}`, { strokes: [] });
      } catch {
        /* ignore */
      }
    }
    const ctx = getCtx();
    const c = canvasRef.current;
    if (ctx && c) ctx.clearRect(0, 0, c.width, c.height);
    setStatus("cleared");
  }

  /* ----- export as PNG download ----- */
  function exportPng() {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.download = `whiteboard-${interviewId || "room"}.png`;
    a.href = c.toDataURL("image/png");
    a.click();
  }

  /* ----- ensure canvas dimensions match its element size ----- */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    c.width = parent.clientWidth;
    c.height = parent.clientHeight;
    redrawAll((room.whiteboardOps as WbOp[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-cyan-400">Real-Time Whiteboard</h2>
        <span
          className={`rounded-full px-3 py-0.5 text-xs border ${
            status === "synced" || status === "restored" || status === "ready"
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
          }`}
        >
          {status === "synced"
            ? "• live"
            : status === "restored"
            ? "• restored"
            : status === "cleared"
            ? "• cleared"
            : "• ready"}
        </span>
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        <button
          onClick={() => setTool("pen")}
          className={`p-2 rounded-lg ${tool === "pen" ? "bg-cyan-500" : "bg-cyan-700"}`}
        >
          <Pencil size={18} />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`p-2 rounded-lg ${tool === "eraser" ? "bg-cyan-500" : "bg-cyan-700"}`}
        >
          <Eraser size={18} />
        </button>
        <button
          onClick={() => setTool("rect")}
          className={`p-2 rounded-lg ${tool === "rect" ? "bg-cyan-500" : "bg-cyan-700"}`}
        >
          <Square size={18} />
        </button>
        <button
          onClick={() => setTool("ellipse")}
          className={`p-2 rounded-lg ${tool === "ellipse" ? "bg-cyan-500" : "bg-cyan-700"}`}
        >
          <Circle size={18} />
        </button>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 rounded cursor-pointer bg-transparent"
          title="Stroke color"
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
        <button
          onClick={clearBoard}
          className="bg-red-600 p-2 rounded-lg hover:bg-red-700"
          title="Clear board"
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={exportPng}
          className="bg-green-600 p-2 rounded-lg hover:bg-green-700"
          title="Export PNG"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="h-96 rounded-lg overflow-hidden border-2 border-slate-700 bg-slate-800 relative">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="absolute inset-0 touch-none cursor-crosshair"
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Drawing syncs via the shared Socket.IO room and persists through the
        backend. Remote operations render live.
      </p>
    </div>
  );
}
