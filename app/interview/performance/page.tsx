"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import api from "@/lib/api";

type Metric = { label: string; value: number | null; hint: string };
type Report = {
  generatedAt?: string;
  interview?: { title?: string };
  assessment?: { overallPercentage?: number; totalScore?: number; totalMax?: number };
  skills?: { ai?: number; coding?: number; communication?: number; security?: number };
  security?: { totalEvents?: number; criticalCount?: number };
};

function PerformanceSurface() {
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const interviews = await api.get<Array<{ _id?: string; id?: string; status?: string }>>("/interviews");
        const rows = Array.isArray(interviews.data) ? interviews.data : [];
        const selected = rows.find((row) => row.status === "completed") || rows[0];
        const id = selected?._id || selected?.id;
        if (!id) throw new Error("No interview is available for performance analysis.");
        const response = await api.get<{ content?: Report; report?: { content?: Report } }>(`/reports/interview/${id}`);
        const data = response.data;
        if (!cancelled) {
          setInterviewId(id);
          setReport(data?.content || data?.report?.content || null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load performance analysis.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const metrics = useMemo<Metric[]>(() => {
    const skills = report?.skills || {};
    return [
      { label: "Overall performance", value: report?.assessment?.overallPercentage ?? null, hint: "Evaluated answers" },
      { label: "Technical / coding", value: skills.coding ?? null, hint: "Coding submissions" },
      { label: "Communication", value: skills.communication ?? null, hint: "Written submissions" },
      { label: "Problem solving", value: skills.ai ?? null, hint: "MCQ submissions" },
      { label: "Interview integrity", value: skills.security ?? null, hint: "Assessment signal" },
      { label: "Security events", value: report?.security?.totalEvents ?? null, hint: `${report?.security?.criticalCount ?? 0} critical` },
    ];
  }, [report]);

  return <div>
    <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Interview analytics</p>
    <h1 className="mt-2 text-3xl font-bold">Performance analysis</h1>
    <p className="mt-2 text-slate-400">Scores are generated from evaluated answers and recorded security events.</p>
    {loading && <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Generating performance analysis…</div>}
    {error && !loading && <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">{error}</div>}
    {!loading && !error && report && <>
      <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5"><p className="font-semibold">{report.interview?.title || "Interview"}</p><p className="mt-1 text-sm text-slate-400">Score {report.assessment?.totalScore ?? 0}/{report.assessment?.totalMax ?? 0} · Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "now"}</p></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{metric.label}</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{metric.value === null ? "—" : `${metric.value}${metric.label === "Security events" ? "" : "%"}`}</p><p className="mt-1 text-xs text-slate-500">{metric.hint}</p></div>)}</div>
      <div className="mt-6"><a href={interviewId ? `/interview/report?id=${encodeURIComponent(interviewId)}` : "/interview/report"} className="inline-block rounded-xl bg-fuchsia-600 px-5 py-3 font-semibold hover:bg-fuchsia-500">View full report</a></div>
    </>}
  </div>;
}

export default function PerformancePage() { return <ProtectedWorkspace eyebrow="Performance"><PerformanceSurface /></ProtectedWorkspace>; }
