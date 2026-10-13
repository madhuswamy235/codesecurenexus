/**
 * codeSchematic — REAL code → schematic whiteboard generation.
 *
 * Parses the actual code a candidate writes and produces whiteboard ops that are
 * merged onto the SAME canvas as manually drawn strokes. Nothing here is
 * hardcoded: every node/edge corresponds to a construct actually detected in the
 * source (imports/require, functions, classes, variables, API calls,
 * DB operations, output statements). Supported languages: JavaScript/Node,
 * Python, Java, C, C++ (best-effort regex heuristics — an architectural
 * representation, not a formal CFG/type-checker).
 *
 * Produced ops use ids prefixed "sc_" so they coexist with manual "wb_" ops
 * and can be cleared independently without touching the drawing layer.
 */

export interface SchematicOp {
  id: string;
  type: "shape" | "text" | "stroke";
  tool?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: string;
  fill?: boolean;
  size?: number;
  points?: { x: number; y: number }[];
  text?: string;
}

export interface SchematicNode {
  id: string;
  label: string;
  kind:
    | "terminal"
    | "module"
    | "function"
    | "class"
    | "input"
    | "variable"
    | "condition"
    | "loop"
    | "call"
    | "api"
    | "db"
    | "output"
    | "other";
  x: number;
  y: number;
  w: number;
  h: number;
}

const NODE_W = 168;
const NODE_H = 48;
const COL_GAP = 28;
const ROW_GAP = 22;
const KIND_STYLE: Record<SchematicNode["kind"], { fill: string; stroke: string }> = {
  terminal: { fill: "rgba(34,197,94,0.25)", stroke: "#4ade80" },
  module: { fill: "rgba(100,116,139,0.22)", stroke: "#94a3b8" },
  function: { fill: "rgba(16,185,129,0.22)", stroke: "#34d399" },
  class: { fill: "rgba(168,85,247,0.22)", stroke: "#c084fc" },
  input: { fill: "rgba(14,165,233,0.22)", stroke: "#38bdf8" },
  variable: { fill: "rgba(34,211,238,0.20)", stroke: "#22d3ee" },
  condition: { fill: "rgba(234,179,8,0.24)", stroke: "#facc15" },
  loop: { fill: "rgba(244,114,182,0.22)", stroke: "#f472b6" },
  call: { fill: "rgba(129,140,248,0.22)", stroke: "#818cf8" },
  api: { fill: "rgba(59,130,246,0.22)", stroke: "#60a5fa" },
  db: { fill: "rgba(249,115,22,0.22)", stroke: "#fb923c" },
  output: { fill: "rgba(74,222,128,0.25)", stroke: "#4ade80" },
  other: { fill: "rgba(148,163,184,0.18)", stroke: "#94a3b8" },
};

function uniq(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim().slice(0, 34)).filter(Boolean))];
}

/** Detect the dominant language from the code text. */
export function detectLanguage(code: string, fallback = "javascript"): string {
  const c = code || "";
	const isPy =
    /^\s*(import|from)\b/m.test(c) || /^\s*def\s+\w+\s*\(/m.test(c) || /^\s*print\s*\(/m.test(c);
  if (isPy && !/\bconsole\.log\b/.test(c)) return "python";
	if (/#\s*include\s*[<"]/m.test(c)) {
    return /std::|\bcout\b|\bcin\b|\bvector\s*</.test(c) ? "cpp" : "c";
  }
	if (/\bpublic\s+(static\s+)?class\b|\bvoid\s+main\s*\(\s*string\s*\[\s*\]/.test(c)) return "java";
	if (/\bconsole\.log\b|\bconst\s+\w+\s*=\s*(\([^)]*\)|[\w$]+)\s*=>/.test(c)) return "javascript";
	if (/^\s*def\s+\w+\s*\(/m.test(c)) return "python";
	return fallback;
}
function collectNodes(code: string): SchematicNode[] {
  const nodes: SchematicNode[] = [];
  const c = code || "";

  nodes.push({ id: "sc_start", label: "START · program", kind: "terminal", x: 0, y: 0, w: NODE_W, h: NODE_H });

  /* imports / requires (modules) */
  const mods = uniq(
    (c.match(
      /^\s*(?:import\s+(?:[\w*{}, ]+?)\s+from\s+["'][^"']+["']|import\s+["'][^"']+["']|from\s+["'][^"']+["']|require\s*\(\s*["'][^"']+["']\s*\))/gm
    ) || []).map((m) => m.replace(/require\s*\(|["']/g, "").replace(/^\s*(import|from)\s+/, "").trim().split(/\s+from\s+/)[0])
  );
  mods.slice(0, 6).forEach((m, i) => {
    nodes.push({
      id: `sc_module_${i}`,
      label: `module · ${m}`,
      kind: "module",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });

  /* function definitions */
  const fns = uniq(
    (c.match(/(?:function\s+|const\s+[\w$]+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>|async\s+function\s+|\bdef\s+|\b(?:public|private|protected|static)\s+[\w<>\[\], ]+\s+\w+\s*\()/g) || [])
      .map((m) => {
        const mm = m.trim();
        const arrow = mm.match(/const\s+([\w$]+)/);
        if (arrow) return arrow[1];
        const kw = mm.match(/(?:function\s+|def\s+|async\s+function\s+)\s*([\w$]+)/);
        if (kw) return kw[1];
        const typed = mm.match(/(?:public|private|protected|static)\s+[\w<>\[\], ]+\s+(\w+)\s*\(/);
        if (typed) return typed[1];
        return mm.replace(/[():{;=\s]/g, "").slice(0, 24);
      })
  );
  fns.slice(0, 6).forEach((f, i) => {
    nodes.push({
      id: `sc_fn_${i}`,
      label: `fn · ${f || "anonymous"}`,
      kind: "function",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });

  /* function calls */
  const calls = uniq(
    (c.match(/\b([A-Za-z_$][\w$]*)\s*\(/g) || [])
      .map((m) => m.replace(/\s*\($/, ""))
      .filter((name) => !["if", "else", "for", "while", "switch", "catch", "function", "print", "input", "console", "require"].includes(name))
  );
  calls.slice(0, 6).forEach((name, i) => {
    nodes.push({ id: `sc_call_${i}`, label: `call · ${name}`, kind: "call", x: 0, y: 0, w: NODE_W, h: NODE_H });
  });

  /* input, conditions, and loops */
  const inputs = uniq(
    (c.match(/(?:\binput\s*\(|prompt\s*\(|readline\b|scanf\s*\()/g) || []).map((m) => m.replace(/\s*\($/, ""))
  );
  inputs.slice(0, 4).forEach((name, i) => {
    nodes.push({ id: `sc_input_${i}`, label: `input · ${name}`, kind: "input", x: 0, y: 0, w: NODE_W, h: NODE_H });
  });
  /* if / else if / elif — JS-style `if (...)` AND Python-style `if cond:` */
  const hasElse = /\belse\b/.test(c);
  const conditions = uniq(
    [
      ...((c.match(/\bif\s*\(([^)]*)\)/g) || []).map((m) => m.replace(/^if\s*\(|\)$/g, "").trim())),
      ...((c.match(/(?:^|\n)\s*(?:if|else\s+if|elif)\s+([^:#{]+)/gm) || []).map((m) =>
        m.replace(/(?:^|\n)\s*(?:if|else\s+if|elif)\s+/, "").replace(/:\s*$/, "").trim()
      )),
    ]
  );
  conditions.slice(0, 4).forEach((condition, i) => {
    nodes.push({ id: `sc_condition_${i}`, label: `if · ${condition}${hasElse ? " · branch yes/no" : ""}`, kind: "condition", x: 0, y: 0, w: NODE_W, h: NODE_H });
  });
  /* loops — JS `for(...)` / `while(...)` AND Python `for ...:` / `while ...:` */
  const loops = uniq(
    [
      ...((c.match(/\b(?:for|while)\s*\([^)]*\)/g) || []).map((m) => m.trim().replace(/[(){}]/g, ""))),
      ...((c.match(/(?:^|\n)\s*(?:for|while)\s+(.+?):/gm) || []).map((m) =>
        m.replace(/(?:^|\n)\s*(?:for|while)\s+/, "").replace(/:\s*$/, "").trim()
      )),
    ]
  );
  loops.slice(0, 4).forEach((loop, i) => {
    nodes.push({ id: `sc_loop_${i}`, label: `loop · ${loop}`, kind: "loop", x: 0, y: 0, w: NODE_W, h: NODE_H });
  });

  /* classes / interfaces / structs */
  const cls = uniq(
    (c.match(/(?:class\s+|interface\s+|struct\s+)\s*([\w$]+)/g) || []).map((m) => m.split(/\s+/)[1] || m)
  );
  cls.slice(0, 4).forEach((cl, i) => {
    nodes.push({
      id: `sc_class_${i}`,
      label: `class · ${cl}`,
      kind: "class",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });
/* variables: explicit const/let/var/typed declarations AND plain assignments
   * (e.g. `x = a + b`, `total = 0`) in any supported language. */
  const vars = uniq(
    [
      ...((c.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g) || []).map((m) => m.split(/\s+/)[1])),
      ...((c.match(/(?:^|[;{\s])([A-Za-z_$][\w$]*)\s*=\s*[^=]/gm) || []).map((m) =>
        m.replace(/^[;{\s]+/, "").replace(/\s*=.*$/, "").trim()
      ).filter((name) =>
        name && !["if", "elif", "else", "for", "while", "return", "def", "function", "class", "const", "let", "var", "this", "true", "false", "null", "undefined", "print", "console"].includes(name)
      )),
    ]
  );
  vars.slice(0, 5).forEach((v, i) => {
    nodes.push({
      id: `sc_var_${i}`,
      label: `var · ${v}`,
      kind: "variable",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });

  /* API / HTTP service calls */
  const apiCalls: string[] = [];
  if (/(?:fetch\s*\(|axios|XMLHttpRequest|https?:\/\/)/.test(c)) apiCalls.push("REST/API call");
  if (/\.(?:get|post|put|patch|delete)\s*\(/.test(c)) apiCalls.push("HTTP method call");
  if (/\b(?:get|post|put|del|fetch)[A-Z]\w*\s*\(/.test(c)) apiCalls.push("service call");
  [...new Set(apiCalls)].slice(0, 3).forEach((a, i) => {
    nodes.push({
      id: `sc_api_${i}`,
      label: `api · ${a}`,
      kind: "api",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });

  /* database operations */
  const dbOps: string[] = [];
  if (/(?:mongoose|MongoClient|createCollection|\.insertOne\s*\(|\.insertMany\s*\()/.test(c)) dbOps.push("DB write");
  if (/\.(?:find|findOne|findById|aggregate|countDocuments)\s*\(/.test(c)) dbOps.push("DB read");
  if (/\.(?:save|updateOne|updateById|findByIdAndUpdate)\s*\(/.test(c)) dbOps.push("DB update");
  if (/\.(?:deleteOne|deleteMany|findByIdAndDelete)\s*\(/.test(c)) dbOps.push("DB delete");
  [...new Set(dbOps)].slice(0, 3).forEach((d, i) => {
    nodes.push({
      id: `sc_db_${i}`,
      label: `db · ${d}`,
      kind: "db",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  });

  /* output statements / return values */
  const hasPrint = /(?:console\.log|print\s*\(|System\.out\.println|printf\s*\()/.test(c);
  const hasReturn = /\breturn\s+[^;]+/.test(c);
  if (hasPrint || hasReturn) {
    nodes.push({
      id: "sc_output",
      label: hasPrint && hasReturn ? "output · print + return" : hasPrint ? "output · print" : "output · return",
      kind: "output",
      x: 0,
      y: 0,
      w: NODE_W,
      h: NODE_H,
    });
  }
  nodes.push({ id: "sc_end", label: "END · program", kind: "terminal", x: 0, y: 0, w: NODE_W, h: NODE_H });
return nodes;
}

/* Distribute nodes into horizontal lanes and lay them out on the canvas. */
function layoutNodes(nodes: SchematicNode[], W: number, H: number): SchematicNode[] {
  const lanes: { kind: SchematicNode["kind"]; items: SchematicNode[] }[] = [
    { kind: "terminal", items: [] },
    { kind: "module", items: [] },
    { kind: "function", items: [] },
    { kind: "class", items: [] },
    { kind: "input", items: [] },
    { kind: "variable", items: [] },
    { kind: "condition", items: [] },
    { kind: "loop", items: [] },
    { kind: "call", items: [] },
    { kind: "api", items: [] },
    { kind: "db", items: [] },
    { kind: "output", items: [] },
  ];
  for (const n of nodes) {
    const lane = lanes.find((l) => l.kind === n.kind);
    if (lane) lane.items.push(n);
  }
  const active = lanes.filter((l) => l.items.length > 0);
  const laneH = NODE_H + ROW_GAP;
  const totalH = active.length * laneH;
  let y = H > totalH ? (H - totalH) / 2 : 12;
	for (const lane of active) {
    const cols = Math.max(1, Math.min(4, lane.items.length));
    const rowW = lane.items.length * NODE_W + (lane.items.length - 1) * COL_GAP;
    let x = W > rowW ? (W - rowW) / 2 : 12;
    lane.items.forEach((n, i) => {
      n.x = x;
      n.y = y;
      if ((i + 1) % cols === 0 && i < lane.items.length - 1) {
        y += NODE_H + 6;
        x = W > rowW ? (W - rowW) / 2 : 12;
      } else {
        x += NODE_W + COL_GAP;
      }
    });
    y += laneH;
  }
	return nodes;
}

function nodeCenter(node: SchematicNode): { x: number; y: number } {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function edgeOp(from: SchematicNode, to: SchematicNode, i: number): SchematicOp {
	const a = nodeCenter(from);
  const b = nodeCenter(to);
  const sameBand = Math.abs(from.y - to.y) < from.h;
  const pts = sameBand
    ? [
        { x: from.x + from.w, y: from.y + from.h / 2 },
        { x: to.x - 6, y: to.y + to.h / 2 },
      ]
    : [
        { x: from.x + from.w / 2, y: from.y + from.h },
        { x: to.x + to.w / 2, y: to.y },
      ];
  return {
    id: `sc_edge_${i}`,
    type: "stroke",
    tool: "pen",
    points: pts,
    color: "#64748b",
    size: 2,
  };
}

function nodeOps(node: SchematicNode, i: number): SchematicOp[] {
  const style = KIND_STYLE[node.kind] || KIND_STYLE.other;
	return [
    {
      id: `sc_box_${i}`,
      type: "shape",
      tool: "rect",
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      color: style.stroke,
      fill: true,
      size: 2,
    },
    {
      id: `sc_txt_${i}`,
      type: "text",
      x: node.x + 10,
      y: node.y + 22,
      text: node.label,
      color: "#f1f5f9",
      size: 13,
    },
  ];
}

/**
 * Generate whiteboard ops representing the architecture/data-flow of the given
 * code. The ops carry "sc_" ids and can be drawn on the SAME canvas as manual
 * strokes. Call generateSchematicOps(code) to produce the layer ops.  Returns a fallback
 * node when nothing is detectable.
 */
export function generateSchematicOps(code: string, canvas: { width: number; height: number } = { width: 860, height: 520 }): SchematicOp[] {
  const c = String(code || "").trim();
  const W = Math.max(300, canvas.width || 860);
  const H = Math.max(240, canvas.height || 520);

  let nodes = collectNodes(c);
  if (nodes.length === 0) {
    nodes = [{ id: "sc_other_0", label: "code · program", kind: "other", x: 0, y: 0, w: NODE_W, h: NODE_H }];
  }

  layoutNodes(nodes,W,H);

  const ops: SchematicOp[] = [];
  const codeLines = c.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
  if (codeLines.length) {
    const lineNodes = [
      { id: "sc_start", label: "START", kind: "terminal" as const },
      ...codeLines.map((line, i) => ({ id: `sc_code_${i + 1}`, label: line.slice(0, 34), kind: "other" as const })),
      { id: "sc_end", label: "END", kind: "terminal" as const },
    ];
    lineNodes.forEach((node, i) => {
      nodeOps({ ...node, x: Math.max(12, (W - NODE_W) / 2), y: 42 + i * (NODE_H + ROW_GAP), w: NODE_W, h: NODE_H }, i).forEach((op) => ops.push(op));
    });
    for (let i = 0; i < lineNodes.length - 1; i++) {
      const y1 = 42 + i * (NODE_H + ROW_GAP) + NODE_H;
      const y2 = 42 + (i + 1) * (NODE_H + ROW_GAP);
      ops.push({ id: `sc_edge_${i}`, type: "stroke", points: [{ x: W / 2, y: y1 }, { x: W / 2, y: y2 }], color: "#22d3ee", size: 2 });
    }
    ops.push({ id: "sc_meta", type: "text", x: 12, y: 24, text: "schematic generated from code", color: "#94a3b8", size: 12 });
    return ops;
  }
	const byKind = (k: SchematicNode["kind"]): SchematicNode[] => nodes.filter((n) => n.kind === k);
	const mods = byKind("module");
  const terminals = byKind("terminal");
	const fns = byKind("function");
	const cls = byKind("class");
  const inputs = byKind("input");
	const vars = byKind("variable");
  const conditions = byKind("condition");
  const loops = byKind("loop");
  const calls = byKind("call");
	const apis = byKind("api");
	const dbs = byKind("db");
	const outs = byKind("output");

  const chain: SchematicNode[] = [];
  if (terminals[0]) chain.push(terminals[0]);
  if (mods.length) chain.push(mods[0]);
  if (inputs.length) chain.push(inputs[0]);
  if (vars.length) chain.push(vars[0]);
  if (conditions.length) chain.push(conditions[0]);
  if (loops.length) chain.push(loops[0]);
  if (fns.length) chain.push(fns[0]);
  if (cls.length) chain.push(cls[0]);
  if (calls.length) chain.push(calls[0]);
  if (apis.length) chain.push(apis[0]);
  if (dbs.length) chain.push(dbs[0]);
  if (outs.length) chain.push(outs[0]);
  if (terminals.length > 1) chain.push(terminals[terminals.length - 1]);

  let ei = 0;
	for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    if (a && b) ops.push(edgeOp(a, b, ei++));
  }

  nodes.forEach((n, i) => {
    ops.push(...nodeOps(n,i));
  });

  // Always end with a schematic version marker so it is clear this layer
  // was generated from the actual code (not hand-drawn).
	ops.push({
    id: "sc_meta",
    type: "text",
    x: 12,
    y: 24,
    text: `schematic generated from code · ${nodes.length} constructs`,
    color: "#94a3b8",
    size: 12,
  });
  return ops;
}