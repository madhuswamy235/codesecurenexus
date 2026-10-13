/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react/no-unescaped-entities */
"use client";

import { FileText, Download, Award, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import api, { getToken } from "@/lib/api";
import config from "@/config";

type ReportContent = {
  reportId?: string;
  status?: string;
  generatedAt?: string;
  interview?: {
    title?: string;
    description?: string;
    type?: string;
    roomCode?: string;
  };
  candidate?: { name?: string; email?: string; mobile?: string } | null;
  interviewer?: { name?: string; email?: string } | null;
  recruiter?: { name?: string; email?: string } | null;
  assessment?: {
    overallPercentage?: number;
    totalScore?: number;
    totalMax?: number;
    mcq?: unknown[];
    coding?: unknown[];
    written?: unknown[];
  };
  security?: {
    totalEvents?: number;
    criticalCount?: number;
  };
  skills?: Array<{ label?: string; score?: number; color?: string }>;
};

export default function InterviewReport() {
  const searchParams = useSearchParams();
  const [interviewId, setInterviewId] = useState<string | null>(searchParams.get("id"));
  const [report, setReport] = useState<ReportContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idFromUrl = searchParams.get("id");
    if (idFromUrl) {
      setInterviewId(idFromUrl);
      return;
    }

    let cancelled = false;

    async function resolveLatestInterview() {
      try {
        const res = await api.get<{ _id?: string; id?: string }[]>('/interviews');
        const rows = Array.isArray(res.data) ? res.data : [];
        const latest = rows[0];
        if (!cancelled) {
          setInterviewId(latest?._id || latest?.id || null);
        }
      } catch {
        if (!cancelled) {
          setInterviewId(null);
        }
      }
    }

    void resolveLatestInterview();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!interviewId) {
      setReport(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get<{ content?: ReportContent; report?: { content?: ReportContent } }>(`/reports/interview/${interviewId}`);
        const payload = res.data as { content?: ReportContent; report?: { content?: ReportContent } } | undefined;
        const nextReport = payload?.content || payload?.report?.content || null;
        if (!cancelled) {
          setReport(nextReport);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the report');
          setReport(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const overallScore = report?.assessment?.overallPercentage ?? 0;
  const recommendation = useMemo(() => {
    if (overallScore >= 80) return 'Selected';
    if (overallScore >= 60) return 'Proceed to panel review';
    if (overallScore > 0) return 'Needs improvement';
    return 'No score available';
  }, [overallScore]);

  async function handleDownload() {
    if (!interviewId) return;

    try {
      const token = getToken();
      const response = await fetch(`${config.apiUrl}/reports/interview/${interviewId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Report download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `securenexus-report-${interviewId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report download failed');
    }
  }

  if (!interviewId && !loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
        <p className="text-sm text-slate-400">No interview report is available yet.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
          <span>Loading interview report…</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-slate-900 p-5 text-red-200">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-4 w-4" />
          <span>{error || 'This interview does not have report data yet.'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl p-5 shadow-lg">
      <h2 className="text-xl font-bold text-cyan-400 mb-5">
        Interview Report
      </h2>

      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-semibold">Candidate</h3>
          <p className="text-gray-400">
            {report.candidate?.name || 'Candidate not assigned'}
            {report.candidate?.email ? ` • ${report.candidate.email}` : ''}
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-semibold">Overall Score</h3>
          <p className="text-green-400 text-2xl font-bold">
            {overallScore}%
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-3">
          <Award className="text-yellow-400" />
          <span>Recommendation: {recommendation}</span>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300">
          <p><span className="text-slate-400">Interview:</span> {report.interview?.title || 'Unassigned interview'}</p>
          <p><span className="text-slate-400">Type:</span> {report.interview?.type || 'MIXED'}</p>
          <p><span className="text-slate-400">Room:</span> {report.interview?.roomCode || 'N/A'}</p>
          <p><span className="text-slate-400">Status:</span> {report.status || 'GENERATED'}</p>
          <p><span className="text-slate-400">Critical security events:</span> {report.security?.criticalCount ?? 0}</p>
        </div>

        {report.skills && report.skills.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-4">
            <h3 className="font-semibold">Skill breakdown</h3>
            <div className="mt-3 space-y-3">
              {report.skills.map((skill) => (
                <div key={skill.label || 'skill'}>
                  <div className="mb-1 flex justify-between text-sm text-slate-300">
                    <span>{skill.label}</span>
                    <span>{skill.score ?? 0}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700">
                    <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, Math.max(0, skill.score ?? 0))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleDownload} className="w-full bg-cyan-600 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-cyan-500">
          <Download size={18}/>
          Download Report
        </button>

        <button className="w-full bg-green-600 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-500" onClick={() => window.open(`/interview/report?id=${interviewId}`, '_self')}>
          <FileText size={18}/>
          View Detailed Report
        </button>
      </div>
    </div>
  );
}
