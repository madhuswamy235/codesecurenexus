"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import api, { ApiError } from "@/lib/api";
import RequireAuth from "@/components/auth/RequireAuth";

const questionOptions = ["MCQ", "CODING"];

export default function RecruiterInterviewsPage() {
  const [title, setTitle] = useState("Senior Frontend Engineer Interview");
  const [candidateName, setCandidateName] = useState("Madhu N S");
  const [candidateEmail, setCandidateEmail] = useState("candidate@securenexus.dev");
  const [interviewType, setInterviewType] = useState("LIVE");
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(["MCQ", "CODING"]);
  const [loading, setLoading] = useState(false);
  const createResultRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<{
    _id?: string;
    sessionId?: string;
    joinLink?: string;
    status?: string;
    sessionStatus?: string;
    candidateName?: string;
    candidateEmail?: string;
    title?: string;
    type?: string;
  } | null>(null);

  function toggleQuestion(option: string) {
    setSelectedQuestions((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setRequiresSignIn(false);
    setNotice("");

    try {
      const result = await api.post<{
        _id?: string;
        sessionId?: string;
        joinLink?: string;
        status?: string;
        sessionStatus?: string;
        title?: string;
        type?: string;
        candidateName?: string;
        candidateEmail?: string;
      }>("/interviews", {
        title,
        candidateName,
        candidateEmail,
        type: interviewType,
        questions: selectedQuestions.map((type) => ({ type })),
      });

      const data = result.data ?? null;
      if (!data?.joinLink) throw new Error("Interview was created but the join link was missing. Open View Session to retrieve it.");
      setCreated(data);
    } catch (err) {
      const authenticationExpired = err instanceof ApiError && err.status === 401;
      setRequiresSignIn(authenticationExpired);
      setError(authenticationExpired
        ? "Your session is no longer valid. Sign in again before creating an interview."
        : err instanceof Error ? err.message : "Unable to create the interview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!created) return;
    const frame = window.requestAnimationFrame(() => {
      createResultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      createResultRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [created]);

  async function copyLink() {
    if (!created?.joinLink) return;
    try {
      await navigator.clipboard.writeText(created.joinLink);
      setNotice("Candidate link copied.");
    } catch {
      setError("Clipboard access is unavailable. Select and copy the candidate link above.");
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">SecureNexus</p>
              <h1 className="mt-2 text-3xl font-bold">Interview Creation Studio</h1>
            </div>
            <Link href="/dashboard" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
              Dashboard
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div>
                <label className="block text-sm text-slate-300">Interview title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500"
                  placeholder="Senior Frontend Engineer Interview"
                  required
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-300">Candidate name</label>
                  <input
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                    placeholder="Madhu N S"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300">Candidate email</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                    placeholder="candidate@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300">Interview type</label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
                >
                  <option value="MIXED">Mixed</option>
                  <option value="MCQ">MCQ</option>
                  <option value="CODING">Coding</option>
                  <option value="LIVE">Live interview</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-300">Select question types</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  {questionOptions.map((option) => {
                    const active = selectedQuestions.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleQuestion(option)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium ${
                          active
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                            : "border-slate-700 bg-slate-950 text-slate-300"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <div role="alert" className="rounded-xl border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <p>{error}</p>
                  {requiresSignIn && (
                    <Link href="/login?next=%2Frecruiter%2Finterviews" className="mt-2 inline-block font-semibold text-red-100 underline underline-offset-2">
                      Sign in again
                    </Link>
                  )}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Creating interview..." : "Create Interview Session"}
              </button>
            </form>

            <div
              ref={createResultRef}
              tabIndex={-1}
              aria-live="polite"
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              {created ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Outcome</p>
                    <h2 className="mt-2 text-2xl font-bold">Interview created successfully</h2>
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    <p><span className="text-slate-500">Candidate:</span> {created.candidateName || candidateName}</p>
                    <p><span className="text-slate-500">Email:</span> {created.candidateEmail || candidateEmail}</p>
                    <p><span className="text-slate-500">Status:</span> {created.sessionStatus || created.status || "WAITING_FOR_CANDIDATE"}</p>
                  </div>

                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidate Join Link</p>
                    <p className="mt-2 break-all text-sm text-emerald-200">{created.joinLink || ""}</p>
                  </div>
                  {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500"
                    >
                      Copy Link
                    </button>
                    <Link
                      href={`/recruiter/interview/${created.sessionId ?? created._id ?? ""}`}
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center font-semibold text-slate-100 hover:bg-slate-700"
                    >
                      View Session
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center text-slate-400">
                  Create a candidate interview to generate the unique join link.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
