"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";

/**
 * useInterviewRoom
 *
 * Connects the SecureNexus interview workspace to the real Express backend and
 * the Socket.IO real-time layer:
 *
 *  - Resolves which interview the user is in (from ?id= or their first one).
 *  - Loads the live interview + session, its questions (answers hidden for
 *    candidates), security summary/timeline, recruiter notes, report and the
 *    honest AI status (configured vs. dev-mock). Nothing here is faked.
 *  - Joins the Socket.IO room and exposes live presence, chat, security and
 *    timer-sync events.
 *
 * Interview activity, optional BLE scan reports, and the Random Forest review
 * signal are separate from camera/video conferencing. An opt-in local face
 * count may emit only a multiple-face count event; no identity or gaze data is used.
 */

interface Member {
  socketId: string;
  userId?: string;
  name: string;
  role: string;
}

export interface ChatMessage {
  _id?: string;
  senderId?: string;
  senderName?: string;
  content: string;
  type?: string;
  createdAt?: string;
}

interface WhiteboardOp {
  id?: string;
  target?: string;
  type?: string;
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  patch?: Record<string, unknown>;
}

interface SessionRecord {
  _id?: string;
  id?: string;
  status?: string;
  timerSecondsRemaining?: number;
  [key: string]: unknown;
}

interface InterviewQuestion {
  _id?: string;
  text?: string;
  [key: string]: unknown;
}

interface InterviewNote {
  _id?: string;
  content?: string;
  [key: string]: unknown;
}

export interface SecurityEventRow {
  _id?: string;
  eventType: string;
  severity?: string;
  details?: Record<string, unknown>;
  userId?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface InterviewRow {
  _id: string;
  title: string;
  description?: string;
  type?: string;
  status?: string;
  roomCode?: string;
  durationMinutes?: number;
  scheduledAt?: string;
  candidate?: { _id: string; name: string; email: string } | null;
  interviewer?: { _id: string; name: string; email: string } | null;
  recruiter?: { _id: string; name: string; email: string } | null;
}

/** Shape of the object returned by useInterviewRoom (single socket lifecycle). */
export type InterviewRoomController = ReturnType<typeof useInterviewRoom>;

function applyWhiteboardOps(current: WhiteboardOp[], incoming: WhiteboardOp[]) {
  let next = [...current];
  for (const op of incoming) {
    if (op?.type === "delete") {
      next = next.filter((item) => item.id !== (op.target || op.id));
      continue;
    }
    if (op?.type === "move" || op?.type === "modify") {
      next = next.map((item) => {
        if (item.id !== (op.target || op.id)) return item;
        return op.type === "move"
          ? { ...item, x: (item.x || 0) + (op.dx || 0), y: (item.y || 0) + (op.dy || 0) }
          : { ...item, ...(op.patch || {}) };
      });
      continue;
    }
    const index = next.findIndex((item) => item.id === op?.id);
    if (index >= 0) next[index] = op;
    else if (op) next.push(op);
  }
  return next;
}

export function useInterviewRoom(options?: { interviewId?: string }) {
  const { user, isAuthenticated } = useAuth();

  const [interviewId, setInterviewId] = useState<string | null>(
    options?.interviewId || null
  );
  const [interview, setInterview] = useState<InterviewRow | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [securitySummary, setSecuritySummary] = useState<Record<string, unknown> | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRow[]>([]);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [aiStatus, setAiStatus] = useState<Record<string, unknown> | null>(null);
  const [presence, setPresence] = useState<Member[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [timer, setTimer] = useState<{ seconds?: number; status?: string }>({});
  const [liveSecurity, setLiveSecurity] = useState<SecurityEventRow[]>([]);
  const [whiteboardOps, setWhiteboardOps] = useState<WhiteboardOp[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "reconnecting" | "rejoining" | "error"
  >("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const joinedRef = useRef(false);

  /* ----- 1. Resolve which interview the user is in ----- */
  useEffect(() => {
    if (!isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function resolve() {
      try {
        if (options?.interviewId) {
          setInterviewId(options.interviewId);
          return;
        }
        const fromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("id")
            : null;
        if (fromUrl) {
          setInterviewId(fromUrl);
          return;
        }
        const list = await api.get<InterviewRow[]>("/interviews");
        if (cancelled) return;
        const rows = (list.data || []) as InterviewRow[];
        if (rows.length) {
          const ordered = [
            ...rows.filter((r) => r.status === "live"),
            ...rows.filter((r) => r.status === "active"),
            ...rows.filter((r) => r.status === "scheduled"),
            ...rows.filter((r) => !["live", "active", "scheduled"].includes(r.status || "")),
          ];
          const candidates = await Promise.all(
            ordered.map(async (row) => {
              try {
                const questions = await api.get<{ data?: InterviewQuestion[] }>(`/questions?interviewId=${row._id}`);
                return { row, hasQuestions: Array.isArray(questions.data) && questions.data.length > 0 };
              } catch {
                return { row, hasQuestions: false };
              }
            })
          );
          if (cancelled) return;
          const preferred = candidates.find((candidate) => candidate.hasQuestions)?.row || ordered[0];
          setInterviewId(preferred._id);
        } else if (!cancelled) {
          setError("No interview assigned to this account yet.");
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load interviews.");
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, options?.interviewId]);

  /* ----- 2. Load all interview data (real backend endpoints) ----- */
  useEffect(() => {
    if (!interviewId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const results = await Promise.allSettled([
          api.get<{ data?: { interview?: InterviewRow; session?: SessionRecord } }>(`/interviews/${interviewId}/session`),
          api.get<InterviewQuestion[]>(`/questions?interviewId=${interviewId}`),
          api.get<Record<string, unknown>>(`/security/summary?interviewId=${interviewId}`),
          api.get<SecurityEventRow[]>(`/security/interview/${interviewId}`),
          api.get<InterviewNote[]>(`/notes/interview/${interviewId}`),
          api.get<Record<string, unknown>>(`/reports/interview/${interviewId}`),
          api.get<Record<string, unknown>>("/ai/status"),
          api.get<ChatMessage[]>(`/chat/${interviewId}/messages`),
        ]);
        if (cancelled) return;

        const [s, q, ss, se, nt, rep, ai, ch] = results as PromiseSettledResult<
          { data?: unknown }
        >[];

        if (s.status === "fulfilled" && s.value.data) {
          const payload = s.value.data as { interview?: InterviewRow; session?: SessionRecord };
          setInterview(payload.interview || null);
          setSession(payload.session || null);
        }
        if (q.status === "fulfilled") setQuestions((q.value.data as InterviewQuestion[]) || []);
        if (ss.status === "fulfilled") setSecuritySummary((ss.value.data as Record<string, unknown>) || null);
        if (se.status === "fulfilled") {
          setSecurityEvents((se.value.data as SecurityEventRow[]) || []);
          setLiveSecurity(((se.value.data as SecurityEventRow[]) || []).slice(0, 12));
        }
        if (nt.status === "fulfilled") setNotes((nt.value.data as InterviewNote[]) || []);
        if (rep.status === "fulfilled" && rep.value.data) {
          setReport(rep.value.data as Record<string, unknown>);
        }
        if (ai.status === "fulfilled") setAiStatus((ai.value.data as Record<string, unknown>) || null);
        if (ch.status === "fulfilled") setChat((ch.value.data as ChatMessage[]) || []);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load interview data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  /* ----- 3. Socket.IO room: presence, chat, timer, security ----- */
  useEffect(() => {
    if (!interviewId || joinedRef.current || typeof window === "undefined") {
      return;
    }

    const socket = getSocket();
    joinedRef.current = true;

    // Track a genuine disconnect so we only rejoin after a real reconnect
    // (Socket.IO also fires 'connect' for the very first connection).
    let wasDisconnected = false;

    const onRoomJoined = (payload: { members?: Member[] } | null) => {
      const unique = new Map<string, Member>();
      for (const member of (payload?.members as Member[]) || []) {
        const key = member.userId ? `user:${member.userId}` : `socket:${member.socketId}`;
        if (!unique.has(key)) unique.set(key, member);
      }
      setPresence([...unique.values()]);
      setError(null);
      setConnectionStatus("connected");
    };
    const onParticipantJoined = (m: Member) => {
      setPresence((prev) =>
        prev.some((p) => p.socketId === m.socketId || (m.userId && p.userId === m.userId))
          ? prev
          : [...prev, m]
      );
    };
    const onParticipantLeft = (m: Member) => {
      setPresence((prev) => prev.filter((p) => p.socketId !== m.socketId));
    };
    const onChat = (msg: ChatMessage) => {
      setChat((prev) => [...prev, msg]);
    };
    const onTimerSync = (t: { seconds?: number; status?: string }) => {
      setTimer(t);
      setConnectionStatus("connected");
    };
    const onSecurity = (ev: SecurityEventRow) => {
      setLiveSecurity((prev) => [ev, ...prev].slice(0, 12));
      setSecuritySummary((prev) => ({
        ...(prev || {}),
        ...(ev.eventType === "TAB_SWITCH" ? { tabSwitchCount: (Number(prev?.tabSwitchCount) || 0) + 1 } : {}),
        ...(ev.eventType === "NEARBY_DEVICE_DETECTED" ? {
          nearbyDeviceCount: (Number(prev?.nearbyDeviceCount) || 0) + (Number(ev.details?.nearbyDeviceCount) || 1),
        } : {}),
        ...(ev.eventType === "MULTIPLE_FACE_DETECTED" ? {
          multipleFaceIncidentCount: (Number(prev?.multipleFaceIncidentCount) || 0) + 1,
        } : {}),
        ...(ev.eventType === "SUSPICIOUS_ACTIVITY" ? {
          suspiciousActivityCount: (Number(prev?.suspiciousActivityCount) || 0) + 1,
        } : {}),
        totalEvents: (Number(prev?.totalEvents) || 0) + 1,
      }));
    };
    const onWhiteboardInit = (payload: { ops?: WhiteboardOp[] } | null) => {
      if (payload && Array.isArray(payload.ops)) {
        setWhiteboardOps(payload.ops);
      }
    };
    const onWhiteboardOp = (payload: { ops?: WhiteboardOp[] } | null) => {
      if (payload && Array.isArray(payload.ops)) {
        setWhiteboardOps((prev) => applyWhiteboardOps(prev, payload.ops || []));
      }
    };
    const onSessionStatus = (payload: { status?: string } | null) => {
      setSession((prev) => ({ ...(prev ?? {}), status: payload?.status ?? prev?.status }));
    };
    const onRoomError = (payload: { message?: string } | null) => {
      setError(payload?.message || "Room error");
      setConnectionStatus("error");
    };
    const onConnect = () => {
      if (wasDisconnected) {
        wasDisconnected = false;
        setConnectionStatus("rejoining");
        // Safely rejoin the authorized room after a temporary disconnect.
        socket.emit("join-room", { interviewId });
      }
    };
    const onDisconnect = () => {
      wasDisconnected = true;
      setConnectionStatus("reconnecting");
    };

    socket.on("room-joined", onRoomJoined);
    socket.on("participant-joined", onParticipantJoined);
    socket.on("participant-left", onParticipantLeft);
    socket.on("participant-disconnected", onParticipantLeft);
    socket.on("chat-message", onChat);
    socket.on("timer-sync", onTimerSync);
    socket.on("security-event", onSecurity);
    socket.on("session-status", onSessionStatus);
    socket.on("room-error", onRoomError);
    socket.on("whiteboard:init", onWhiteboardInit);
    socket.on("whiteboard:op", onWhiteboardOp);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.emit("join-room", { interviewId });

    return () => {
      socket.off("room-joined", onRoomJoined);
      socket.off("participant-joined", onParticipantJoined);
      socket.off("participant-left", onParticipantLeft);
      socket.off("participant-disconnected", onParticipantLeft);
      socket.off("chat-message", onChat);
      socket.off("timer-sync", onTimerSync);
      socket.off("security-event", onSecurity);
      socket.off("session-status", onSessionStatus);
      socket.off("room-error", onRoomError);
      socket.off("whiteboard:init", onWhiteboardInit);
      socket.off("whiteboard:op", onWhiteboardOp);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      joinedRef.current = false;
    };
  }, [interviewId]);

  /* ----- Actions ----- */
  const sendChat = useCallback((content: string) => {
    getSocket().emit("chat-message", { content });
  }, []);

  const syncTimer = useCallback(
    (seconds: number, status = "running") => {
      setTimer({ seconds, status });
      getSocket().emit("timer-sync", { seconds, status });
    },
    []
  );


  /** Emit whiteboard operations locally and through the existing room channel. */
  const emitWhiteboardOps = useCallback((ops: WhiteboardOp[]) => {
    if (!ops.length) return;
    setWhiteboardOps((prev) => applyWhiteboardOps(prev, ops));
    getSocket().emit("whiteboard:op", { ops });
  }, []);

  const emitWhiteboardOp = useCallback((op: WhiteboardOp) => {
    emitWhiteboardOps([op]);
  }, [emitWhiteboardOps]);

  /** Emit a timer control (start/pause/resume/end) — persisted server-side. */
  const sendTimerControl = useCallback(
    (action: string, seconds?: number) => {
      if (!interviewId) return;
      const nextStatus = action === "start" || action === "resume" ? "active" : action === "pause" ? "paused" : action === "cancel" ? "cancelled" : action === "end" ? "completed" : undefined;
      setTimer((prev) => ({
        seconds: seconds ?? prev.seconds,
        status: nextStatus || prev.status,
      }));
      getSocket().emit("timer:control", {
        action,
        ...(seconds !== undefined ? { seconds } : {}),
      });
    },
    [interviewId]
  );

  /** Persist + broadcast a security event with honest UI feedback. */
  const logSecurity = useCallback(
    async (eventType: string, severity: string, details: Record<string, unknown> = {}) => {
      if (!interviewId) return null;
      const res = await api.post<Record<string, unknown>>("/security/event", {
        interviewId,
        sessionId: session?._id || null,
        userId: user?._id || null,
        eventType,
        severity,
        details,
      });
      return res.data;
    },
    [interviewId, session?._id, user?._id]
  );

  const recordSecurityEvent = logSecurity;

  const saveNote = useCallback(
    async (content: string) => {
      if (!interviewId) return null;
      const res = await api.post<Record<string, unknown>>("/notes", { interviewId, content });
      setNotes((prev) => [...prev, (res.data || {}) as InterviewNote]);
      return res.data;
    },
    [interviewId]
  );

  const startInterview = useCallback(async () => {
    if (!interviewId) return null;
    const res = await api.post<{ session?: SessionRecord }>(`/interviews/${interviewId}/start`, {
      timerSeconds: (interview?.durationMinutes || 60) * 60,
    });
    if (res.data) setSession(res.data.session || null);
    return res.data;
  }, [interviewId, interview]);

  const endInterview = useCallback(async () => {
    if (!interviewId) return null;
    const res = await api.post<{ session?: SessionRecord }>(`/interviews/${interviewId}/end`);
    if (res.data) setSession(res.data.session || null);
    return res.data;
  }, [interviewId]);

  const cancelInterview = useCallback(async () => {
    if (!interviewId) return null;
    const res = await api.post<{ session?: SessionRecord }>(`/interviews/${interviewId}/cancel`);
    if (res.data) setSession(res.data.session || null);
    setTimer((prev) => ({ ...prev, status: "cancelled" }));
    return res.data;
  }, [interviewId]);

  return {
    user,
    interviewId,
    interview,
    session,
    questions,
    securitySummary,
    securityEvents,
    notes,
    report,
    aiStatus,
    presence,
    chat,
    timer,
    liveSecurity,
    whiteboardOps,
    connectionStatus,
    loading,
    error,
    sendChat,
    syncTimer,
    emitWhiteboardOp,
    emitWhiteboardOps,
    sendTimerControl,
    recordSecurityEvent,
    logSecurity,
    saveNote,
    startInterview,
    endInterview,
    cancelInterview,
  };
}
