"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import InterviewReadinessCheck from "@/components/interview/InterviewReadinessCheck";
import WindowsProximityCompanion from "@/components/interview/WindowsProximityCompanion";

type ProximityStatus = "detected" | "none" | "unsupported" | "denied" | "error" | "not-run";

interface SessionDetails {
  _id?: string;
  sessionId?: string;
  status?: string;
  startedAt?: string | null;
  deviceIntegrity?: {
    browserBound?: boolean;
    proximityStatus?: ProximityStatus;
    nearbyDeviceCount?: number;
    checkedAt?: string;
  } | null;
  roomScanStatus?: "NOT_REQUESTED" | "CREATED" | "UPLOADED" | "REVIEWED";
}

interface InterviewDetails {
  _id?: string;
  title?: string;
  type?: string;
  status?: string;
  candidateName?: string;
  scheduledAt?: string | null;
  durationMinutes?: number;
  recruiter?: { name?: string } | null;
}

interface InvitationResponse {
  interview?: InterviewDetails;
  session?: SessionDetails;
}

const DEVICE_ID_PREFIX = "securenexus-interview-device:";

function browserDeviceId(invitation: string) {
  const key = `${DEVICE_ID_PREFIX}${invitation}`;
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  if (!window.crypto?.randomUUID) {
    throw new Error("This browser cannot create a secure device identifier. Use an up-to-date browser.");
  }
  const value = window.crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

function roomPath(interviewId?: string) {
  return `/interview?id=${encodeURIComponent(interviewId || "")}`;
}

export default function InterviewJoinPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { sessionId: invitationToken } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interview, setInterview] = useState<InterviewDetails | null>(null);
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const invitePath = `/interview/join/${encodeURIComponent(invitationToken)}`;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await api.get<InvitationResponse>(
          `/interviews/invite/${encodeURIComponent(invitationToken)}`,
          false
        );
        if (!active) return;
        setInterview(response.data?.interview ?? null);
        setSession(response.data?.session ?? null);
        if (!response.data?.interview || !response.data?.session) {
          setError("This interview invitation is invalid or has expired.");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load this interview invitation.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (invitationToken) void load();
    return () => {
      active = false;
    };
  }, [invitationToken]);

  useEffect(() => {
    if (!joined || session?.status === "ACTIVE" || !invitationToken) return;
    const timer = window.setInterval(() => {
      void api.get<InvitationResponse>(`/interviews/invite/${encodeURIComponent(invitationToken)}`, false)
        .then((response) => {
          const nextInterview = response.data?.interview;
          const nextSession = response.data?.session;
          if (nextInterview) setInterview(nextInterview);
          if (nextSession) {
            setSession(nextSession);
            if (nextSession.status === "ACTIVE") router.replace(roomPath(nextInterview?._id));
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Unable to refresh the interview lobby.");
        });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [invitationToken, joined, router, session?.status]);

  async function recordNearbyDeviceCount(count: number) {
    if (!interview?._id || !session?._id || !user?._id) return;
    try {
      await api.post("/security/event", {
        interviewId: interview._id,
        sessionId: session._id,
        userId: user._id,
        eventType: "NEARBY_DEVICE_DETECTED",
        severity: "MEDIUM",
        source: "windows-proximity-companion",
        details: { nearbyDeviceCount: count, evidence: "candidate-browser-relayed-local-companion" },
      });
    } catch (err) {
      setError(err instanceof Error ? `Unable to save the companion scan result: ${err.message}` : "Unable to save the companion scan result.");
    }
  }

  async function handleJoin() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(invitePath)}`);
      return;
    }
    if (user?.role !== "candidate") {
      setError("Sign in with the candidate account invited to this interview.");
      return;
    }
    if (!interview || !session) return;
    if (!session.roomScanStatus || !["UPLOADED", "REVIEWED"].includes(session.roomScanStatus)) {
      setError("Complete the room scan first. Ask the interviewer for the one-time room-scan link, show the entire room, and upload it before joining.");
      return;
    }

    setJoining(true);
    setError("");
    try {
      const deviceId = browserDeviceId(invitationToken);
      const response = await api.post<InvitationResponse>(`/interviews/${encodeURIComponent(invitationToken)}/join`, {
        deviceId,
      });
      const joinedSession = response.data?.session;
      if (joinedSession) setSession(joinedSession);
      setJoined(true);
      if (joinedSession?.status === "ACTIVE") {
        router.push(roomPath(interview._id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join the interview right now.");
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading interview invitation...</div>;
  }

  const ended = ["ENDED", "CANCELLED"].includes(session?.status || "") ||
    ["completed", "cancelled"].includes(interview?.status || "");
  const loginPath = `/login?next=${encodeURIComponent(invitePath)}`;
  const registerPath = `/register?next=${encodeURIComponent(invitePath)}`;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">SecureNexus</p>
        <h1 className="mt-3 text-3xl font-bold">You’re invited to an interview</h1>
        <p className="mt-2 text-sm text-slate-400">Review the details below, then sign in or create a free candidate account to join.</p>

        {error && <div role="alert" className="mt-6 rounded-lg border border-red-600/30 bg-red-600/10 p-4 text-red-200">{error}</div>}

        {interview && session && (
          <>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p><span className="text-slate-400">Candidate:</span> {interview.candidateName || user?.name || "Invited candidate"}</p>
              <p><span className="text-slate-400">Interview:</span> {interview.title || "Live interview"}</p>
              <p><span className="text-slate-400">Recruiter:</span> {interview.recruiter?.name || "Recruiter"}</p>
              <p><span className="text-slate-400">Type:</span> {interview.type || "MIXED"}</p>
              <p><span className="text-slate-400">Duration:</span> {interview.durationMinutes || 60} minutes</p>
              <p><span className="text-slate-400">Status:</span> {session.status || interview.status || "WAITING"}</p>
            </div>

            {!ended && (
              <section className="mt-6 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <h2 className="font-semibold text-cyan-200">Ready to join?</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Use the invited candidate email. If you need an account, create one here—your invitation link will be saved and you’ll return to this page automatically after registration.
                </p>
                <InterviewReadinessCheck role="candidate" />
                <div className={`mt-4 rounded-xl border p-4 text-sm ${["UPLOADED", "REVIEWED"].includes(session.roomScanStatus || "") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                  <p className="font-semibold">Room scan: {session.roomScanStatus || "Not completed"}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{["UPLOADED", "REVIEWED"].includes(session.roomScanStatus || "") ? "The room scan is uploaded. You can continue after the camera and microphone check." : "You must use the one-time room-scan link from the interviewer, show the entire room, and upload the 30-second recording before joining."}</p>
                </div>
                {session._id && interview._id && (
                  <WindowsProximityCompanion
                    sessionId={session._id}
                    onNewDevices={recordNearbyDeviceCount}
                  />
                )}
              </section>
            )}

            {ended ? (
              <div className="mt-6 rounded-lg border border-red-600/30 bg-red-600/10 p-4 text-red-200">This interview has ended or was cancelled.</div>
            ) : joined && session.status !== "ACTIVE" ? (
              <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
                You are in the lobby. This page will open the interview when the recruiter starts it.
              </div>
            ) : (
              <button
                onClick={() => void handleJoin()}
                disabled={joining || !interview || !session || !["UPLOADED", "REVIEWED"].includes(session.roomScanStatus || "")}
                className="mt-8 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-60"
              >
                {joining ? "Joining..." : isAuthenticated ? "Join interview lobby" : "Sign in to continue"}
              </button>
            )}

            {!isAuthenticated && !ended && (
              <p className="mt-4 text-center text-sm text-slate-400">
                New candidate? <Link href={registerPath} className="font-semibold text-emerald-300 hover:underline">Create a candidate account</Link>
                {" · "}
                <Link href={loginPath} className="text-cyan-300 hover:underline">Sign in</Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
