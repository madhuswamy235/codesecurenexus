"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, FileText, Plus, Radio, ShieldCheck, Sparkles, Video } from "lucide-react";
import api from "@/lib/api";
import { canCreateInterviewsForRole, useAuth } from "@/hooks/useAuth";

interface Stats {
  interviews: { total: number; scheduled: number; live: number; completed: number };
  assessment: { scorePercent: number | null; codingScorePercent: number | null; scoredQuestionCount: number };
  security: { criticalEvents: number };
  weekly: { interviewsCreated: number; questionsScored: number; criticalEvents: number };
  storageMode?: string;
}

interface InterviewRow { _id: string; title: string; status: string; type: string; candidate?: { name: string } | null; }

function percentage(value: number | null | undefined) { return value == null || !Number.isFinite(value) ? "—" : `${Math.round(Math.max(0, Math.min(100, value)))}%`; }

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const live = ["active", "live"].includes(normalized);
  const done = ["completed", "ended"].includes(normalized);
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-emerald-50 text-emerald-700" : done ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : done ? "bg-slate-400" : "bg-amber-500"}`} />{status.replace(/_/g, " ")}</span>;
}

export default function InterviewDashboard() {
  const { user } = useAuth();
  const canCreate = canCreateInterviewsForRole(user?.role);
  const [stats, setStats] = useState<Stats | null>(null);
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [statsResponse, interviewsResponse] = await Promise.all([api.get<Stats>("/users/stats"), api.get<InterviewRow[]>("/interviews")]);
        if (cancelled) return;
        setStats(statsResponse.data || null);
        setInterviews(Array.isArray(interviewsResponse.data) ? interviewsResponse.data : []);
        setApiStatus("connected");
      } catch { if (!cancelled) setApiStatus("error"); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const greeting = user?.name ? `Good to see you, ${user.name.split(" ")[0]}.` : "Welcome to your workspace.";

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:flex-row sm:items-center sm:px-8"><div><p className="text-sm text-emerald-300">{greeting}</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Your interview overview</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A clear snapshot of your interviews, results, and next actions.</p></div>{canCreate ? <Link href="/recruiter/interviews" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400"><Plus size={17} /> Create interview</Link> : <div className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Candidate workspace</div>}</section>

      {apiStatus === "error" && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">We could not load the latest workspace data. Check your connection and refresh.</div>}
      {apiStatus === "connected" && <p className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={15} className="text-emerald-500" /> Connected to {stats?.storageMode === "file" ? "development storage" : "your SecureNexus data"}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Video} label="Total interviews" value={stats ? String(stats.interviews.total) : "—"} detail={stats ? `${stats.interviews.scheduled} scheduled` : "Loading"} color="text-emerald-600" />
        <Metric icon={Radio} label="Live now" value={stats ? String(stats.interviews.live) : "—"} detail="Active interview rooms" color="text-cyan-600" />
        <Metric icon={BarChart3} label="Assessment score" value={stats ? percentage(stats.assessment.scorePercent) : "—"} detail={stats ? `${stats.assessment.scoredQuestionCount} scored questions` : "Loading"} color="text-violet-600" />
        <Metric icon={ShieldCheck} label="Security events" value={stats ? String(stats.security.criticalEvents) : "—"} detail="Critical events recorded" color="text-amber-600" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Activity</p><h2 className="mt-2 text-xl font-bold">Recent interviews</h2></div>{canCreate && <Link href="/recruiter/interviews" className="text-sm font-semibold text-emerald-700 hover:text-emerald-600">View all <ArrowRight size={15} className="ml-1 inline" /></Link>}</div><div className="mt-6 divide-y divide-slate-100">{interviews.length === 0 ? <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">{canCreate ? "No interviews yet. Create your first interview to get started." : "Your assigned interviews will appear here."}</div> : interviews.slice(0, 5).map((interview) => <div key={interview._id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{interview.title}</p><p className="mt-1 text-xs text-slate-500">{interview.candidate?.name || "Candidate"} · {interview.type || "Live interview"}</p></div><div className="flex items-center gap-3"><StatusBadge status={interview.status || "scheduled"} /><Link href={`/interview?id=${encodeURIComponent(interview._id)}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">Open</Link></div></div>)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">This week</p><h2 className="mt-2 text-xl font-bold">Progress at a glance</h2><div className="mt-6 space-y-4"><Progress icon={Video} label="Interviews created" value={stats?.weekly.interviewsCreated || 0} /><Progress icon={FileText} label="Questions scored" value={stats?.weekly.questionsScored || 0} /><Progress icon={ShieldCheck} label="Security events" value={stats?.weekly.criticalEvents || 0} /></div><Link href="/interview/performance" className="mt-6 block rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700">View performance</Link></div>
      </section>

      <section><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Shortcuts</p><h2 className="mt-2 text-xl font-bold">Go where you need to go</h2></div></div><div className="mt-4 grid gap-4 md:grid-cols-3"><Shortcut href={canCreate ? "/recruiter/interviews" : "/interview"} icon={canCreate ? Plus : Video} title={canCreate ? "Create an interview" : "Open interview room"} text={canCreate ? "Set up a candidate invitation and start a session." : "Open your assigned live interview."} /><Shortcut href="/learning" icon={Sparkles} title="Learning center" text="Practice coding, DSA, MCQs, and whiteboard work." /><Shortcut href="/interview/report" icon={FileText} title="Reports" text="Review completed interviews and recommendations." /></div></section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, color }: { icon: typeof Video; label: string; value: string; detail: string; color: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Icon size={20} className={color} /><p className="mt-5 text-sm text-slate-500">{label}</p><p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>; }
function Progress({ icon: Icon, label, value }: { icon: typeof Video; label: string; value: number }) { return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon size={17} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-sm"><span className="text-slate-600">{label}</span><span className="font-bold text-slate-800">{value}</span></div><div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(8, value * 10))}%` }} /></div></div></div>; }
function Shortcut({ href, icon: Icon, title, text }: { href: string; icon: typeof Video; title: string; text: string }) { return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white group-hover:bg-emerald-600"><Icon size={18} /></span><h3 className="mt-5 font-bold text-slate-800">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Open <ArrowRight size={15} /></span></Link>; }
