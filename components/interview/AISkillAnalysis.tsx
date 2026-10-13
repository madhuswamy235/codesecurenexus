"use client";

import { Brain, Code, Mic, ShieldCheck } from "lucide-react";

/**
 * AI Skill Analysis — UI/demo only.
 *
 * The active build has no AI provider configured for skill analysis, so these
 * bars are illustrative placeholders, not real measurements. This is stated
 * honestly rather than claiming fabricated "AI scores".
 */
export default function AISkillAnalysis() {
  const demo = [
    { icon: <Code size={18} />, label: "Coding", pct: 0 },
    { icon: <Mic size={18} />, label: "Communication", pct: 0 },
    { icon: <ShieldCheck size={18} />, label: "Security", pct: 0 },
    { icon: <Brain size={18} />, label: "Overall AI Score", pct: 0 },
  ];

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-cyan-400 mb-0">AI Skill Analysis</h2>
        <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300 uppercase">
          demo — not configured
        </span>
      </div>

      <div className="space-y-4">
        {demo.map((d) => (
          <div key={d.label}>
            <div className="flex justify-between mb-1">
              <span className="flex items-center gap-2">{d.icon} {d.label}</span>
              <span>–</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div className="bg-slate-600 h-2 rounded-full w-0"></div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-slate-500">
        Skill-score bars are placeholders. Real AI skill analysis requires an AI
        provider to be configured on the backend (see /api/ai/status).
      </p>
    </div>
  );
}