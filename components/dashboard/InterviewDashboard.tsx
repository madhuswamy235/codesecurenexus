"use client";
import AILearningAssistant from "./AILearningAssistant";

import  { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { canCreateInterviewsForRole, useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface Stats {
  users: { total: number; byRole: { role: string; count: number }[] };
  interviews: { total: number; scheduled: number; live: number; completed: number };
  assessment: {
    evaluationRatePercent: number | null;
    eligibleQuestionCount: number;
    evaluatedQuestionCount: number;
    scoredQuestionCount: number;
    scorePercent: number | null;
    codingScorePercent: number | null;
    performanceByTag: { tag: string; scorePercent: number; evaluatedCount: number }[];
  };
  communicationScorePercent: number | null;
  communicationUnavailableReason: string;
  security: { criticalEvents: number };
  weekly: { interviewsCreated: number; questionsScored: number; criticalEvents: number };
  unreadNotifications: number;
  storageMode?: string;
}

function formatPercentage(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "Not available" : `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: string }) {
  const unavailable = value === "Not available" || value === "Not enough data" || value === "Loading…" || value === "Unavailable";
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-4 font-bold ${accent} ${unavailable ? "text-xl" : "text-3xl"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

interface InterviewRow {
  _id: string;
  title: string;
  status: string;
  type: string;
  candidate?: { name: string } | null;
}

export default function InterviewDashboard() {
  const [showAILearning, setShowAILearning] = useState(false);


  const [currentTime, setCurrentTime] = useState("");

  const { user, logout } = useAuth();
  const canCreateInterview = canCreateInterviewsForRole(user?.role);
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [notifications, setNotifications] = useState<{ _id: string; message: string; title?: string }[]>([]);
  const [apiStatus, setApiStatus] = useState<'loading' | 'connected' | 'error'>('loading');

  useEffect(() => {

    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);

  }, []);

  // Load real dashboard data from the SecureNexus backend
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statsRes, interviewsRes, notifRes] = await Promise.all([
          api.get('/users/stats'),
          api.get('/interviews'),
          api.get('/users/notifications'),
        ]);
        if (cancelled) return;
        setStats((statsRes.data as Stats) || null);
        setInterviews((Array.isArray(interviewsRes.data) ? interviewsRes.data : []) as InterviewRow[]);
        const notificationList = Array.isArray(notifRes.data) ? notifRes.data : [];
        setNotifications(notificationList.map((n: { _id: string; message: string; title?: string }) => ({ _id: n._id, message: n.message, title: n.title })));
        setApiStatus('connected');
      } catch {
        if (!cancelled) setApiStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };
  const weeklyMetrics: Array<[string, number]> = stats ? [
    ["Interviews created", stats.weekly.interviewsCreated],
    ["Questions scored", stats.weekly.questionsScored],
    ["Critical events", stats.weekly.criticalEvents],
  ] : [];
  const hasWeeklyActivity = weeklyMetrics.some(([, count]) => count > 0);

  return (

    <div className="min-h-screen bg-slate-950 text-white">

      {/* ================= HEADER ================= */}

      <header className="border-b border-slate-800 bg-slate-900 px-4 py-5 sm:px-8">

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h1 className="text-4xl font-bold text-cyan-400">
              SecureNexus Dashboard
            </h1>

            <p className="text-slate-400 mt-2">
              Enterprise AI Interview Analytics Platform
            </p>

            {apiStatus === 'error' && (
              <p className="mt-2 text-sm text-red-400">
                ⚠️ Backend not reachable. Start the Express server (see README) and refresh.
              </p>
            )}
            {apiStatus === 'connected' && (
              <p className="mt-2 text-sm text-green-400">
                ● Connected to backend {stats?.storageMode === 'file' ? '(dev/demo storage)' : '(MongoDB)'}
              </p>
            )}

          </div>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">

            <div className="text-left sm:text-right">
              <p className="text-slate-400">
                Live Time
              </p>
              <h2 className="text-2xl font-bold text-green-400">
                {currentTime}
              </h2>
            </div>

            {user && (
              <div className="text-left">
                <p className="text-slate-400">
                  Signed in as
                </p>
                <h2 className="text-sm font-bold text-cyan-400">
                  {user.name} ({user.role})
                </h2>
              </div>
            )}

            {user ? (
              <button onClick={handleLogout} className="rounded-lg border border-red-800 bg-red-900/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/70">
                Logout
              </button>
            ) : (
              <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold">
                Login
              </Link>
            )}

            {canCreateInterview && (
              <Link
                href="/recruiter/interviews"
                className="whitespace-nowrap rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold transition hover:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-300"
              >
                Create Interview
              </Link>
            )}

          </div>

        </div>

      </header>

      {/* ================= TOP CARDS ================= */}

      <section className="grid grid-cols-1 gap-4 p-8 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Assessment Score"
          value={stats ? formatPercentage(stats.assessment.scorePercent) : apiStatus === "loading" ? "Loading…" : "Unavailable"}
          detail={stats ? `${stats.assessment.scoredQuestionCount} valid scored questions · weighted by max score` : "Based on persisted evaluated question scores."}
          accent="text-cyan-400"
        />
        <MetricCard
          label="Evaluation Rate"
          value={stats ? formatPercentage(stats.assessment.evaluationRatePercent) : apiStatus === "loading" ? "Loading…" : "Unavailable"}
          detail={stats ? `${stats.assessment.evaluatedQuestionCount} of ${stats.assessment.eligibleQuestionCount} submitted questions evaluated` : "Not a model-quality score; this is completion status only."}
          accent="text-emerald-400"
        />
        <MetricCard
          label="Coding Score"
          value={stats ? formatPercentage(stats.assessment.codingScorePercent) : apiStatus === "loading" ? "Loading…" : "Unavailable"}
          detail="Weighted score from evaluated coding questions only."
          accent="text-yellow-400"
        />
        <MetricCard
          label="Communication Score"
          value="Not enough data"
          detail={stats?.communicationUnavailableReason || "No validated communication score is available."}
          accent="text-fuchsia-400"
        />
        <MetricCard
          label="Critical Security Events"
          value={stats ? String(stats.security.criticalEvents) : apiStatus === "loading" ? "Loading…" : "Unavailable"}
          detail="Stored events explicitly marked CRITICAL; not a security score."
          accent="text-pink-400"
        />
        <MetricCard
          label="Interviews Completed"
          value={stats ? String(stats.interviews.completed) : apiStatus === "loading" ? "Loading…" : "Unavailable"}
          detail="Count of stored interviews with completed status."
          accent="text-orange-400"
        />
      </section>
      <section className="grid gap-5 px-8 pb-8 md:grid-cols-2 xl:grid-cols-4">
        {canCreateInterview ? (
          <Link href="/recruiter/interviews" className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-6 hover:bg-emerald-400/15">
            <p className="text-lg font-semibold text-emerald-300">Interview Studio</p>
            <p className="mt-2 text-sm text-slate-400">Create candidate interviews, generate join links and monitor session status.</p>
            <span className="mt-5 inline-block text-sm font-semibold">Create Interview -&gt;</span>
          </Link>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-lg font-semibold text-slate-300">Interview Studio</p>
            <p className="mt-2 text-sm text-slate-400">Sign in to create and manage candidate interviews.</p>
          </div>
        )}
        <Link href="/learning" className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-6 hover:bg-cyan-400/15">
          <p className="text-lg font-semibold text-cyan-300">Learning Center</p>
          <p className="mt-2 text-sm text-slate-400">Practice coding, DSA, MCQs and collaborative learning.</p>
          <span className="mt-5 inline-block text-sm font-semibold">Open Learning -&gt;</span>
        </Link>
        <Link href="/interview/performance" className="rounded-2xl border border-orange-400/30 bg-orange-400/10 p-6 hover:bg-orange-400/15">
          <p className="text-lg font-semibold text-orange-300">Performance</p>
          <p className="mt-2 text-sm text-slate-400">View interview performance, AI analysis and skill progress.</p>
          <span className="mt-5 inline-block text-sm font-semibold">View Performance -&gt;</span>
        </Link>
        <Link href="/interview/report" className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-6 hover:bg-fuchsia-400/15">
          <p className="text-lg font-semibold text-fuchsia-300">Reports</p>
          <p className="mt-2 text-sm text-slate-400">View available interview reports and recommendations.</p>
          <span className="mt-5 inline-block text-sm font-semibold">View Reports -&gt;</span>
        </Link>
      </section>
      {/* ================= MAIN CONTENT ================= */}

      <section className="grid grid-cols-12 gap-6 px-8 pb-8">

        {/* Left Section */}

        <div className="col-span-8 space-y-6">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-2xl font-bold">
                Performance by Question Tag
              </h2>

              <span className="bg-cyan-600 rounded-full px-4 py-2 text-sm">
                Stored scores
              </span>

            </div>

            {stats?.assessment.performanceByTag.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {stats.assessment.performanceByTag.map((metric, index) => {
                  const accents = ["text-cyan-300", "text-emerald-300", "text-amber-300", "text-fuchsia-300", "text-sky-300", "text-lime-300"];
                  return (
                    <div key={metric.tag} className="rounded-xl bg-slate-800 p-5">
                      <p className="text-slate-400">{metric.tag}</p>
                      <p className={`mt-3 text-3xl font-bold ${accents[index % accents.length]}`}>{formatPercentage(metric.scorePercent)}</p>
                      <p className="mt-2 text-xs text-slate-500">{metric.evaluatedCount} evaluated question{metric.evaluatedCount === 1 ? "" : "s"}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-800 p-5 text-sm text-slate-400">
                {stats ? "Not enough tagged, evaluated questions to show skill performance." : apiStatus === "loading" ? "Loading stored performance…" : "Performance data unavailable."}
              </div>
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">Only stored evaluated question scores with explicit question tags are included. No communication or inferred skill score is generated.</p>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <h2 className="text-2xl font-bold mb-6">
                Recent Interviews
              </h2>

              <div className="space-y-4">

                {interviews.length === 0 ? (
                  <div className="rounded-xl bg-slate-800 p-4 text-slate-400">
                    {canCreateInterview ? "No interviews yet. Use Create Interview to get started." : "No interviews are available for this account yet."}
                  </div>
                ) : (
                  interviews.slice(0, 5).map((iv) => (
                    <div key={iv._id} className="flex justify-between items-center rounded-xl bg-slate-800 p-4">
                      <span>
                        {iv.title}
                        {iv.candidate?.name ? (
                          <span className="ml-2 text-sm text-slate-500">— {iv.candidate.name}</span>
                        ) : null}
                      </span>
                      <span className={
                        iv.status === 'completed'
                          ? 'text-green-400 font-bold'
                          : iv.status === 'live'
                          ? 'text-cyan-400 font-bold'
                          : 'text-yellow-400 font-bold'
                      }>
                        {iv.status.toUpperCase()}
                      </span>
                    </div>
                  ))
                )}

                {interviews.length > 0 && (
                  <Link href="/interview" className="block rounded-xl border border-cyan-700 bg-slate-800 p-4 text-center text-cyan-400 hover:bg-slate-700">
                    Open Interview Workspace →
                  </Link>
                )}

              </div>

          </div>

        </div>
        {/* Right Section */}

        <div className="col-span-4 space-y-6">

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <h2 className="text-xl font-bold mb-5">
              AI Recommendations
            </h2>

            <div className="space-y-4">

              <div className="rounded-xl bg-slate-800 p-4">
                🤖 Improve Dynamic Programming speed.
              </div>

              <div className="rounded-xl bg-slate-800 p-4">
                🎯 Practice System Design interviews.
              </div>

              <div className="rounded-xl bg-slate-800 p-4">
                🎤 Improve communication confidence.
              </div>

              <div className="rounded-xl bg-slate-800 p-4">
                🧩 Use clear, structured examples.
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <h2 className="text-xl font-bold mb-5">
              Live Security Status
            </h2>

            <div className="space-y-4">
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="font-medium">Camera and microphone</p>
                <p className="mt-1 text-sm text-slate-400">Permissions are requested in the live meeting when a participant starts their camera or microphone.</p>
              </div>
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="font-medium">Browser activity</p>
                <p className="mt-1 text-sm text-slate-400">Tab, window, and fullscreen events are recorded during an active interview.</p>
              </div>
              <div className="rounded-xl bg-slate-800 p-4">
                <p className="font-medium">Nearby Bluetooth LE</p>
                <p className="mt-1 text-sm text-slate-400">Optional candidate-triggered companion scan; it is not a precise distance or exhaustive device check.</p>
              </div>
            </div>

          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <h2 className="text-xl font-bold mb-5">
              Weekly Progress
            </h2>

            <p className="mb-4 text-xs text-slate-500">Rolling 7-day activity from stored records.</p>
            {stats && hasWeeklyActivity ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {weeklyMetrics.map(([label, count]) => (
                  <div key={label} className="rounded-xl bg-slate-800 p-4">
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-cyan-300">{count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p role={apiStatus === "error" ? "alert" : undefined} className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                {!stats && apiStatus === "loading" ? "Loading weekly activity…" : !stats ? "Weekly activity is unavailable." : "No recorded activity in the last 7 days."}
              </p>
            )}

          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

            <h2 className="text-xl font-bold mb-5">
              Live Notifications
            </h2>

            <div className="space-y-3">

              {notifications.length === 0 ? (
                <div className="rounded-lg bg-slate-800 p-3 text-slate-400">
                  No new notifications.
                </div>
              ) : (
                notifications.slice(0, 4).map((n) => (
                  <div key={n._id} className="rounded-lg bg-slate-800 p-3">
                    <span className="text-sm text-slate-300">{n.message}</span>
                  </div>
                ))
              )}
              <div
  onClick={() => setShowAILearning(true)}
  className="cursor-pointer rounded-2xl border border-slate-700 bg-slate-900 p-6 hover:border-cyan-500 transition"
>
  <h2 className="text-xl font-bold text-white">
    🤖 AI Learning Assistant
  </h2>

  <p className="mt-2 text-slate-400">
    Learn concepts, practice coding and prepare for interviews.
  </p>
</div>
{showAILearning && (
  <div className="fixed inset-0 z-50 bg-black/80 overflow-auto p-6">

    <button
      onClick={() => setShowAILearning(false)}
      className="mb-4 rounded-xl bg-red-600 px-5 py-2 text-white"
    >
      Close
    </button>

    <AILearningAssistant />

  </div>
)}

<Link
  href="/interview/security"
  className="block rounded-2xl border border-slate-700 bg-slate-900 p-6 transition hover:border-green-500"
>
  <h2 className="text-xl font-bold text-white">🛡 Interview Integrity Monitor</h2>
  <p className="mt-2 text-slate-400">
    Review browser activity events and optional Bluetooth LE advertisement signals.
  </p>
</Link>

            </div>

          </div>

        </div>

      </section>

    </div>

  );
}