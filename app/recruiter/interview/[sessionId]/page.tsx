"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import api, { getToken } from "@/lib/api";
import config from "@/config";
import { useAuth } from "@/hooks/useAuth";
import RequireAuth from "@/components/auth/RequireAuth";

interface SessionResponse {
  interview?: {
    _id?: string;
    title?: string;
    type?: string;
    status?: string;
    candidateName?: string;
    candidateEmail?: string;
    recruiter?: { name?: string; email?: string } | null;
  };
  session?: {
    _id?: string;
    sessionId?: string;
    status?: string;
    candidateName?: string;
    candidateEmail?: string;
    joinToken?: string;
    deviceIntegrity?: {
      browserBound?: boolean;
      proximityStatus?: string;
      nearbyDeviceCount?: number;
      checkedAt?: string;
    } | null;
    startedAt?: string;
    endedAt?: string;
  };
}

interface RoomScanRow { _id?: string; status?: string; expiresAt?: string; phoneAwaySelfReport?: boolean; media?: { index: number; originalName?: string; mimeType?: string }[] }

export default function RecruiterInterviewSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { user, loading: authLoading } = useAuth();
  const { sessionId } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<SessionResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [roomScans, setRoomScans] = useState<RoomScanRow[]>([]);
  const [scanLink, setScanLink] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;

    const load = async () => {
      try {
        const result = await api.get<SessionResponse>(`/interviews/${sessionId}/session`);
        setData(result.data ?? null);
        if (result.data?.interview?._id) {
          const scans = await api.get<RoomScanRow[]>(`/room-scans/interviews/${result.data.interview._id}`);
          setRoomScans(scans.data || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load this interview session.");
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      void load();
    }
  }, [authLoading, sessionId, user]);

  useEffect(() => {
    if (!["CREATED", "WAITING_FOR_CANDIDATE", "READY"].includes(data?.session?.status || "")) return;
    let active = true;
    const timer = window.setInterval(() => {
      void api.get<SessionResponse>(`/interviews/${sessionId}/session`)
        .then((result) => {
          if (active) setData(result.data ?? null);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "Unable to refresh interview status.");
        });
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [data?.session?.status, sessionId]);

  const interview = data?.interview;
  const session = data?.session;
  const canManageSession = user?.role === "admin" || user?.role === "recruiter" || user?.role === "interviewer";
  const joinLink = `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/interview/join/${encodeURIComponent(session?.joinToken || session?.sessionId || sessionId)}`;

  async function updateSession(action: "start" | "end") {
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await api.post<SessionResponse>(`/interviews/${sessionId}/${action}`);
      setData(result.data ?? null);
      setNotice(action === "start" ? "Interview started. The candidate lobby will open automatically." : "Interview ended.");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} this interview.`);
    } finally {
      setActionLoading(false);
    }
  }

  async function createScanLink() {
    if (!interview?._id) return;
    try {
      const result = await api.post<{ url?: string }>(`/room-scans/interviews/${interview._id}/token`);
      setScanLink(result.data?.url || "");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create a room-scan link."); }
  }

  async function openScanMedia(scanId: string, index: number) {
    try {
      const response = await fetch(`${config.apiUrl}/room-scans/${scanId}/media/${index}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error("Unable to open room-scan media");
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to open room-scan media."); }
  }

  async function markScanReviewed(scanId: string) {
    try {
      await api.post(`/room-scans/${scanId}/reviewed`);
      setRoomScans((rows) => rows.map((row) => row._id === scanId ? { ...row, status: "REVIEWED" } : row));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update room-scan status."); }
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading interview session...</div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">SecureNexus</p>
              <h1 className="mt-2 text-3xl font-bold">Interview Session</h1>
            </div>
            <Link href="/recruiter/interviews" className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700">
              Back to interviews
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-red-200">{error}</div>
          ) : null}

          {interview && (
            <div className="mt-8 space-y-5 text-sm text-slate-300">
              <p><span className="text-slate-500">Title:</span> {interview.title}</p>
              <p><span className="text-slate-500">Candidate:</span> {interview.candidateName || "Candidate"}</p>
              <p><span className="text-slate-500">Email:</span> {interview.candidateEmail || "candidate@example.com"}</p>
              <p><span className="text-slate-500">Type:</span> {interview.type || "MIXED"}</p>
              <p><span className="text-slate-500">Status:</span> {session?.status || interview.status || "WAITING_FOR_CANDIDATE"}</p>
              {session?.deviceIntegrity && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidate device check</p>
                  <p className="mt-2">Browser bound: {session.deviceIntegrity.browserBound ? "Yes" : "No"}</p>
                  <p>Bluetooth scan: {session.deviceIntegrity.proximityStatus || "Not run"}</p>
                  <p>Nearby Bluetooth advertisements reported: {session.deviceIntegrity.nearbyDeviceCount ?? 0}</p>
                  {(session.deviceIntegrity.nearbyDeviceCount ?? 0) > 0 && (
                    <p role="status" className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                      Nearby BLE advertising signals were reported. Review with the candidate; this is not a verified device identity or exact-distance measurement.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">The opt-in Windows scanner sees advertising Bluetooth LE signals only. It can miss phones/laptops and cannot prove that other devices are absent or exactly two metres away.</p>
                  {session.deviceIntegrity.browserBound && !["ENDED", "CANCELLED"].includes(session.status || "") && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!window.confirm("Reset the candidate's browser binding? The candidate can then join from a different browser.")) return;
                        setActionLoading(true);
                        setError("");
                        try {
                          const result = await api.post<SessionResponse>(`/interviews/${sessionId}/device/reset`);
                          setData(result.data ?? null);
                          setNotice("Candidate device binding reset.");
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Unable to reset the candidate device.");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      Reset browser binding
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidate Join Link</p>
                <p className="mt-2 break-all text-sm text-emerald-200">{joinLink}</p>
              </div>

              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Consented mobile room scan</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">Generate a unique expiring link tied to this interview. Candidate consent is required; the phone-away confirmation is only a self-report, not proof of physical placement.</p>
                <button type="button" onClick={() => void createScanLink()} className="mt-3 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold">Create room-scan link</button>
                {scanLink && <p className="mt-3 break-all rounded-lg bg-slate-950 p-3 text-xs text-emerald-200">{scanLink}</p>}
                <div className="mt-4 space-y-3">{roomScans.length === 0 ? <p className="text-xs text-slate-500">No room scan has been uploaded.</p> : roomScans.map((scan) => <div key={scan._id} className="rounded-lg border border-slate-700 p-3 text-xs"><p>Status: <span className="text-cyan-200">{scan.status}</span></p><p className="mt-1">Media: {scan.media?.length || 0} file(s)</p><p className="mt-1 text-slate-500">Phone-away confirmation: {scan.phoneAwaySelfReport ? "candidate self-report only" : "not provided"}</p>{scan._id && scan.media?.map((item) => <button key={item.index} type="button" onClick={() => void openScanMedia(scan._id || "", item.index)} className="mr-3 mt-2 inline-block text-cyan-300 underline">Review {item.originalName || `media ${item.index + 1}`}</button>)}{scan._id && scan.status !== "REVIEWED" && <button type="button" onClick={() => void markScanReviewed(scan._id || "")} className="mt-3 block rounded-lg border border-emerald-500/40 px-3 py-2 text-emerald-200">Mark reviewed</button>}</div>)}</div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(joinLink);
                    setNotice("Candidate link copied.");
                  } catch {
                    setError("Clipboard access is unavailable. Select and copy the link above.");
                  }
                }}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500"
              >
                Copy Link
              </button>
              {canManageSession && !(["ENDED", "CANCELLED"].includes(session?.status || "") || ["completed", "cancelled"].includes(interview.status || "")) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void updateSession("start")}
                    disabled={actionLoading || session?.status === "ACTIVE"}
                    className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    {actionLoading ? "Updating..." : session?.status === "ACTIVE" ? "Interview is live" : "Start interview"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateSession("end")}
                    disabled={actionLoading || session?.status !== "ACTIVE"}
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    End interview
                  </button>
                </div>
              )}
              {session?.status === "ACTIVE" && interview?._id && (
                <Link href={`/interview?id=${encodeURIComponent(interview._id)}`} className="block w-full rounded-xl bg-cyan-600 px-4 py-3 text-center font-semibold text-white hover:bg-cyan-500">
                  Open live interview room
                </Link>
              )}
              {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
