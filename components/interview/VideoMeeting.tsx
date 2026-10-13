/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Mic, MicOff, VideoOff, PhoneOff, SlidersHorizontal } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useLocalFaceCount } from "@/hooks/useLocalFaceCount";
import { describeMediaError, listMediaDevices, loadIceServers, queryMediaPermission, type IceServerConfig } from "@/lib/webrtc/ice";

type PeerMember = { socketId: string; userId?: string; name: string; role: string };
type SignalDescription = { type: string; sdp: string };
type SignalCandidate = { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null; [key: string]: unknown };

type VideoMeetingProps = {
  interviewId?: string;
  isCandidate?: boolean;
  sessionActive?: boolean;
  joinRoom?: boolean;
  members?: PeerMember[];
  logSecurity?: (eventType: string, severity: string, details: Record<string, unknown>) => Promise<unknown>;
};

const ignoreSecurityEvent = async () => undefined;

export default function VideoMeeting({
  interviewId,
  isCandidate = false,
  sessionActive = false,
  joinRoom = true,
  members = [],
  logSecurity = ignoreSecurityEvent,
}: VideoMeetingProps) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const stopRequestedRef = useRef(false);
  const makingOfferRef = useRef(false);
  const initiatorRef = useRef(false);
  const micOnRef = useRef(true);
  const remoteNameRef = useRef("");
  const iceServersRef = useRef<IceServerConfig[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const remoteDescriptionSetRef = useRef(false);
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState | "idle">("idle");
  const [signalingState, setSignalingState] = useState("disconnected");
  const [permissionStatus, setPermissionStatus] = useState({ camera: "unknown", microphone: "unknown" });
  const [deviceStatus, setDeviceStatus] = useState({ cameras: 0, microphones: 0 });
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);
  const [candidateType, setCandidateType] = useState("unknown");
  const [iceWarning, setIceWarning] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  // Automatic local review once the candidate camera is active. Video frames
  // stay in this browser; only multiple-face count events are persisted.
  const [faceCountOptIn, setFaceCountOptIn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState("");
  const [calibrated, setCalibrated] = useState(false);
  const [camStatus, setCamStatus] = useState("idle");
  const [callStatus, setCallStatus] = useState("Waiting for interviewer/candidate...");
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | "idle">("idle");
  const [remoteName, setRemoteName] = useState("");
  const [cameraHealth, setCameraHealth] = useState<"idle" | "active" | "muted" | "ended">("idle");
  const cameraIdleReportedRef = useRef(false);

  const onMultipleFaces = useCallback((faceCount: number) => {
    if (!interviewId) return Promise.resolve();
    return logSecurity("MULTIPLE_FACE_DETECTED", "MEDIUM", { faceCount });
  }, [interviewId, logSecurity]);
  const onCameraObscured = useCallback(() => {
    if (!interviewId) return Promise.resolve();
    return logSecurity("CAMERA_OBSCURED", "MEDIUM", { source: "local-face-detector", reason: "no-face-visible" });
  }, [interviewId, logSecurity]);
  const faceCountEnabled = isCandidate && sessionActive && cameraOn && faceCountOptIn;
  const faceMonitor = useLocalFaceCount({ enabled: faceCountEnabled, videoRef: localRef, onMultipleFaces, onCameraObscured });

  const reportCameraIdle = useCallback((reason: "muted" | "ended") => {
    setCameraHealth(reason);
    if (!interviewId || cameraIdleReportedRef.current) return;
    cameraIdleReportedRef.current = true;
    void logSecurity("CAMERA_IDLE", "MEDIUM", { reason, source: "media-track" });
  }, [interviewId, logSecurity]);

  useEffect(() => {
    if (!isCandidate || !sessionActive || !cameraOn) setFaceCountOptIn(false);
  }, [cameraOn, isCandidate, sessionActive]);

  const closePeer = useCallback((notify = false) => {
    const targetSocketId = remoteSocketIdRef.current;
    if (notify && targetSocketId) socketRef.current?.emit("webrtc:call-ended", { targetSocketId });
    peerRef.current?.close();
    peerRef.current = null;
    remoteSocketIdRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setConnectionState("idle");
    setIceConnectionState("idle");
    setRemoteStreamReady(false);
    setRemoteName("");
    setCallStatus("Waiting for interviewer/candidate...");
  }, []);

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([queryMediaPermission("camera"), queryMediaPermission("microphone"), listMediaDevices()]).then(([camera, microphone, devices]) => {
      if (cancelled) return;
      setPermissionStatus({ camera, microphone });
      setDeviceStatus({
        cameras: devices.filter((device) => device.kind === "videoinput").length,
        microphones: devices.filter((device) => device.kind === "audioinput").length,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [logSecurity, reportCameraIdle]);

  const stopLocal = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (localRef.current) localRef.current.srcObject = null;
    setCameraOn(false);
    setCameraHealth("idle");
    setLocalStreamReady(false);
    setCamStatus("stopped");
  }, []);

  const createPeer = useCallback((targetSocketId: string) => {
    if (peerRef.current) return peerRef.current;
    const socket = socketRef.current;
    if (!socket) return null;
    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerRef.current = peer;
    remoteSocketIdRef.current = targetSocketId;
    streamRef.current?.getTracks().forEach((track) => peer.addTrack(track, streamRef.current as MediaStream));
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteRef.current && stream) {
        remoteRef.current.srcObject = stream;
        setRemoteStreamReady(true);
        void remoteRef.current.play().catch(() => undefined);
      }
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) socket.emit("webrtc:ice-candidate", { targetSocketId, candidate: event.candidate.toJSON() });
    };
    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (peer.connectionState === "connected") setCallStatus(`Connected${remoteNameRef.current ? ` with ${remoteNameRef.current}` : ""}`);
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) setCallStatus("Connection lost. Waiting for peer...");
    };
    peer.oniceconnectionstatechange = () => {
      setIceConnectionState(peer.iceConnectionState);
      if (peer.iceConnectionState === "failed") {
        setCallStatus("ICE connection failed. Check network access or configure TURN.");
      }
    };
    peer.onsignalingstatechange = () => setSignalingState(peer.signalingState);
    peer.onicecandidateerror = (event) => {
      setError(`ICE candidate error ${event.errorCode}: ${event.errorText || "network path unavailable"}`);
    };
    peer.addEventListener("connectionstatechange", () => {
      if (peer.connectionState !== "connected") return;
      void peer.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded" && report.nominated) {
            const localCandidate = stats.get(report.localCandidateId);
            if (localCandidate?.candidateType) setCandidateType(localCandidate.candidateType);
          }
        });
      });
    });
    return peer;
  }, []);

  const ensureLocal = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => { track.enabled = true; });
      setCameraOn(true);
      setCameraHealth("active");
      setCamStatus("active");
      if (localRef.current) {
        localRef.current.srcObject = streamRef.current;
        await localRef.current.play().catch(() => undefined);
      }
      return streamRef.current;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not support camera and microphone access.");
    stopRequestedRef.current = false;
    setError("");
    setCamStatus("requesting");
    // Request video independently. Browsers reject a combined request when
    // only the microphone is blocked, which unnecessarily prevents the camera
    // from opening.
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    let audioTracks: MediaStreamTrack[] = [];
    if (micOnRef.current) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        audioTracks = audioStream.getAudioTracks();
      } catch (audioError) {
        setPermissionStatus((previous) => ({ ...previous, microphone: "denied" }));
        void logSecurity("CAMERA_ERROR", "MEDIUM", { source: "microphone-permission", error: audioError instanceof DOMException ? audioError.name : "denied" });
      }
    }
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);
    if (stopRequestedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Camera setup was cancelled.");
    }
    streamRef.current = stream;
    cameraIdleReportedRef.current = false;
    setCameraHealth("active");
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener("mute", () => reportCameraIdle("muted"));
      videoTrack.addEventListener("unmute", () => { cameraIdleReportedRef.current = false; setCameraHealth("active"); });
      videoTrack.addEventListener("ended", () => reportCameraIdle("ended"));
    }
    setPermissionStatus({ camera: "granted", microphone: stream.getAudioTracks().length ? "granted" : "denied" });
    const devices = await listMediaDevices();
    setDeviceStatus({
      cameras: devices.filter((device) => device.kind === "videoinput").length,
      microphones: devices.filter((device) => device.kind === "audioinput").length,
    });
    if (localRef.current) {
      localRef.current.srcObject = stream;
      await localRef.current.play().catch(() => undefined);
    }
    setCameraOn(true);
    setLocalStreamReady(true);
    setCamStatus("active");
    void logSecurity("CAMERA_STARTED", "LOW", { source: "media-stream" });
    return stream;
  }, [reportCameraIdle]);

  const sendOffer = useCallback(async (targetSocketId: string) => {
    if (!initiatorRef.current || makingOfferRef.current) return;
    try {
      await ensureLocal();
      const peer = createPeer(targetSocketId);
      if (!peer) return;
      makingOfferRef.current = true;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.emit("webrtc:offer", { targetSocketId, sdp: peer.localDescription?.toJSON() || offer });
      setCallStatus("Calling peer...");
    } catch (err) {
      setError(describeMediaError(err));
      setCamStatus("error");
    } finally {
      makingOfferRef.current = false;
    }
  }, [createPeer, ensureLocal]);

  useEffect(() => {
    if (!interviewId || typeof window === "undefined") return;
    const socket = getSocket();
    socketRef.current = socket;
    setSignalingState(socket.connected ? "connected" : "connecting");
    void loadIceServers().then((result) => {
      iceServersRef.current = result.iceServers;
      setIceWarning(result.warning || "");
    });

    const onRoomJoined = (payload: { members?: PeerMember[] }) => {
      const members = payload.members || [];
      const peer = members.find((member) => member.socketId !== socket.id);
      if (peer) {
        initiatorRef.current = (socket.id || "") < peer.socketId;
        remoteSocketIdRef.current = peer.socketId;
        remoteDescriptionSetRef.current = false;
        remoteNameRef.current = peer.name;
        setRemoteName(peer.name);
        setCallStatus("Peer joined. Start camera to connect.");
        if (initiatorRef.current && streamRef.current) void sendOffer(peer.socketId);
      }
    };
    const onPeerJoined = (member: PeerMember) => {
      if (member.socketId === socket.id) return;
      initiatorRef.current = (socket.id || "") < member.socketId;
      remoteSocketIdRef.current = member.socketId;
      remoteDescriptionSetRef.current = false;
      remoteNameRef.current = member.name;
      setRemoteName(member.name);
      setCallStatus("Peer joined. Start camera to connect.");
      if (initiatorRef.current && streamRef.current) void sendOffer(member.socketId);
    };
    const onOffer = async (payload: { fromSocketId: string; sdp: SignalDescription }) => {
      try {
        await ensureLocal();
        const peer = createPeer(payload.fromSocketId);
        if (!peer) return;
        await peer.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
        remoteDescriptionSetRef.current = true;
        for (const candidate of pendingCandidatesRef.current.splice(0)) await peer.addIceCandidate(candidate);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("webrtc:answer", { targetSocketId: payload.fromSocketId, sdp: peer.localDescription?.toJSON() || answer });
        setCallStatus("Answering peer...");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to answer the video call.");
      }
    };
    const onAnswer = async (payload: { fromSocketId: string; sdp: SignalDescription }) => {
      if (!peerRef.current || payload.fromSocketId !== remoteSocketIdRef.current) return;
      await peerRef.current.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      remoteDescriptionSetRef.current = true;
      for (const candidate of pendingCandidatesRef.current.splice(0)) await peerRef.current.addIceCandidate(candidate);
    };
    const onIceCandidate = async (payload: { fromSocketId: string; candidate: SignalCandidate }) => {
      const candidate = payload.candidate as RTCIceCandidateInit;
      if (!peerRef.current || payload.fromSocketId !== remoteSocketIdRef.current || !remoteDescriptionSetRef.current) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      await peerRef.current.addIceCandidate(candidate).catch(() => undefined);
    };
    const onPeerLeft = (payload: { socketId: string }) => {
      if (payload.socketId === remoteSocketIdRef.current) closePeer();
    };
    const onCallEnded = (payload: { fromSocketId: string }) => {
      if (payload.fromSocketId === remoteSocketIdRef.current) {
        closePeer();
        setCallStatus("The other participant ended the call.");
      }
    };
    const onConnect = () => {
      setSignalingState("connected");
      if (joinRoom) socket.emit("join-room", { interviewId });
    };
    const onDisconnect = () => {
      setSignalingState("disconnected");
      closePeer();
      setConnectionState("idle");
      setCallStatus("Signaling disconnected. Reconnecting...");
    };
    const onRoomError = (payload: { message?: string }) => {
      setError(payload?.message || "Unable to join the interview room.");
      setCallStatus("Interview room unavailable");
    };
    const onConnectError = (event: Error) => {
      setSignalingState("error");
      setError(`Signaling connection failed: ${event.message}`);
    };

    socket.on("room-joined", onRoomJoined);
    socket.on("participant-joined", onPeerJoined);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIceCandidate);
    socket.on("webrtc:peer-left", onPeerLeft);
    socket.on("webrtc:call-ended", onCallEnded);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-error", onRoomError);
    socket.on("connect_error", onConnectError);
    if (socket.connected && joinRoom) socket.emit("join-room", { interviewId });
    return () => {
      socket.off("room-joined", onRoomJoined);
      socket.off("participant-joined", onPeerJoined);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIceCandidate);
      socket.off("webrtc:peer-left", onPeerLeft);
      socket.off("webrtc:call-ended", onCallEnded);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-error", onRoomError);
      socket.off("connect_error", onConnectError);
      closePeer(true);
      stopLocal();
      socketRef.current = null;
    };
  }, [closePeer, createPeer, ensureLocal, interviewId, joinRoom, sendOffer, stopLocal]);

  useEffect(() => {
    const socket = socketRef.current;
    if (joinRoom || !socket || !members.length) return;
    const peer = members.find((member) => member.socketId !== socket.id);
    if (!peer) return;
    initiatorRef.current = (socket.id || "") < peer.socketId;
    remoteSocketIdRef.current = peer.socketId;
    remoteDescriptionSetRef.current = false;
    remoteNameRef.current = peer.name;
    setRemoteName(peer.name);
    setCallStatus("Peer joined. Start camera to connect.");
    if (initiatorRef.current && streamRef.current) void sendOffer(peer.socketId);
  }, [joinRoom, members, sendOffer]);

  const startCamera = async () => {
    try {
      await ensureLocal();
      if (initiatorRef.current && remoteSocketIdRef.current) await sendOffer(remoteSocketIdRef.current);
      else if (remoteSocketIdRef.current) setCallStatus("Camera ready. Waiting for interviewer offer...");
    } catch (err) {
      setError(describeMediaError(err));
      const name = err instanceof DOMException ? err.name : "";
      void logSecurity(name === "NotAllowedError" || name === "SecurityError" ? "CAMERA_DENIED" : "CAMERA_ERROR", "MEDIUM", {
        source: "getUserMedia",
        error: name || "unknown",
      });
      const [camera, microphone] = await Promise.all([queryMediaPermission("camera"), queryMediaPermission("microphone")]);
      setPermissionStatus({ camera, microphone });
      setCamStatus("error");
    }
  };

  const stopCamera = () => {
    stopRequestedRef.current = true;
    setFaceCountOptIn(false);
    closePeer(true);
    stopLocal();
    if (interviewId) void logSecurity("CAMERA_ENDED", "LOW", { source: "user-stop" });
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
  };

  const toggleCamera = () => {
    if (!cameraOn) {
      void startCamera();
      return;
    }
    streamRef.current?.getVideoTracks().forEach((track) => { track.enabled = false; });
    setCameraOn(false);
    reportCameraIdle("muted");
    setCamStatus("camera off");
    if (interviewId) void logSecurity("CAMERA_ENDED", "LOW", { source: "user-toggle" });
  };

  const toggleFaceReview = () => {
    const enabled = !faceCountOptIn;
    setFaceCountOptIn(enabled);
    if (interviewId) void logSecurity("FACE_REVIEW_CONSENT", "LOW", { enabled, scope: "local-face-count-only" });
  };

  const faceCountLabel = !cameraOn
    ? "Turn your camera on before opting in."
    : !faceCountOptIn
      ? "Off by default. Enable to count visible faces locally."
      : faceMonitor.status === "loading"
        ? "Loading the on-device detector…"
        : faceMonitor.status === "unavailable"
          ? "Detector unavailable; interview continues normally."
          : faceMonitor.faceCount === null
            ? "Waiting for a camera frame…"
            : faceMonitor.faceCount === 0
              ? "No face detected"
              : faceMonitor.faceCount === 1
                ? "One face detected"
                : `${faceMonitor.faceCount} faces detected`;

  const calibrate = async () => {
    setCalibrated(true);
    if (!cameraOn) {
      setError("Start the camera, then calibration can apply preferred constraints.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: micOn });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (peerRef.current) {
        const senders = peerRef.current.getSenders();
        for (const track of stream.getTracks()) {
          const sender = senders.find((item) => item.track?.kind === track.kind);
          if (sender) await sender.replaceTrack(track);
        }
      }
      if (localRef.current) localRef.current.srcObject = stream;
      setLocalStreamReady(true);
      setPermissionStatus({ camera: "granted", microphone: stream.getAudioTracks().length ? "granted" : "denied" });
      setError("Camera calibration applied.");
    } catch (err) {
      setError(describeMediaError(err));
    }
  };

  return <div className="rounded-xl bg-slate-900 p-5 shadow-lg">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-cyan-400">Live Interview Meeting</h2><span className={`rounded-full border px-3 py-0.5 text-xs ${connectionState === "connected" ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : camStatus === "error" ? "border-red-500/40 bg-red-500/20 text-red-300" : "border-slate-600 bg-slate-700/40 text-slate-400"}`}>{connectionState === "connected" ? "connected" : camStatus === "error" ? "camera unavailable" : callStatus}</span></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-lg border border-gray-700 bg-black"><video ref={localRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOn ? "block" : "hidden"}`} />{!cameraOn && <div className="p-3 text-center"><Video size={45} className="mx-auto mb-3 text-cyan-400" /><h3 className="font-semibold">Candidate Camera</h3><p className="text-sm text-gray-400">{error || "Camera off"}</p></div>}<span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-cyan-300">You</span></div>
      <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-lg border border-gray-700 bg-black"><video ref={remoteRef} autoPlay playsInline className={`h-full w-full object-cover ${connectionState === "connected" ? "block" : "hidden"}`} />{connectionState !== "connected" && <div className="p-3 text-center"><Video size={45} className="mx-auto mb-3 text-green-400" /><h3 className="font-semibold">{remoteName || "Remote participant"}</h3><p className="px-3 text-sm text-gray-400">{callStatus}</p></div>}<span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] text-green-300">Interviewer / candidate</span></div>
    </div>
    {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs">
        <p className="text-slate-400">Camera health</p>
        <p className={`mt-1 font-semibold ${cameraHealth === "active" ? "text-emerald-300" : cameraHealth === "idle" ? "text-slate-300" : "text-amber-300"}`}>
          {cameraHealth === "active" ? "Active" : cameraHealth === "idle" ? "Not started" : cameraHealth === "muted" ? "Idle / muted" : "Track ended"}
        </p>
        <p className="mt-1 text-slate-500">A live muted or ended track creates a review alert.</p>
      </div>
      {isCandidate && sessionActive && cameraOn && faceCountOptIn && (
        <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs">
          <p className="text-slate-400">Face framing assist</p>
          <p className="mt-1 font-semibold text-cyan-300">{faceMonitor.framing === "centered" ? "Centered" : faceMonitor.framing === "off-center" ? "Off-center" : faceMonitor.framing === "no-face" ? "No face" : "Checking…"}</p>
          <p className="mt-1 text-slate-500">Local framing guidance only; eye contact is not measured or stored.</p>
        </div>
      )}
    </div>
    {isCandidate && sessionActive && (
       <section className="mt-4 rounded-xl border border-slate-700 bg-slate-950 p-4" aria-label="Automatic local face count">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
             <h3 className="font-semibold text-slate-100">Automatic multi-face review</h3>
            <p className="mt-1 text-xs text-slate-400">{faceCountLabel}</p>
          </div>
          <button
            type="button"
            onClick={toggleFaceReview}
            disabled={!cameraOn}
            aria-pressed={faceCountOptIn}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
             {faceCountOptIn ? "Withdraw consent" : "Enable local review"}
          </button>
        </div>
        {faceMonitor.faceCount !== null && faceMonitor.faceCount >= 2 && faceCountOptIn && cameraOn && (
          <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Multiple faces appear in view. Please ensure only the candidate is visible. This is an approximate review signal.
          </p>
        )}
        {faceMonitor.error && <p role="alert" className="mt-2 text-xs text-amber-300">{faceMonitor.error}</p>}
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          If enabled, face counting runs locally in this browser while your camera is on. Only a multiple-face count and event time are saved for recruiter review—no face identity, gaze/eye-contact analysis, screenshots, or detector frames are stored or sent. The interview video call itself remains peer-to-peer.
        </p>
      </section>
    )}
    <div className="mt-5 flex flex-wrap justify-center gap-4"><button onClick={toggleMic} className={`rounded-full p-3 ${micOn ? "bg-cyan-500" : "bg-gray-600"}`} title={micOn ? "Mute microphone" : "Unmute microphone"}>{micOn ? <Mic /> : <MicOff />}</button><button onClick={toggleCamera} className={`rounded-full p-3 ${cameraOn ? "bg-cyan-500" : "bg-yellow-500"}`} title={cameraOn ? "Turn camera off" : "Turn camera on"}>{cameraOn ? <Video /> : <VideoOff />}</button><button onClick={calibrate} className="rounded-full bg-purple-600 p-3" title="Camera calibration"><SlidersHorizontal /></button><button onClick={stopCamera} className="rounded-full bg-red-600 p-3" title="End video call"><PhoneOff /></button></div>
    <div className="mt-5 grid gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
      <p>Camera permission: <span className="text-slate-200">{permissionStatus.camera}</span></p>
      <p>Microphone permission: <span className="text-slate-200">{permissionStatus.microphone}</span></p>
      <p>Devices: <span className="text-slate-200">{deviceStatus.cameras} camera / {deviceStatus.microphones} mic</span></p>
      <p>Signaling: <span className="text-slate-200">{signalingState}</span></p>
      <p>ICE: <span className="text-slate-200">{iceConnectionState}</span></p>
      <p>Peer: <span className="text-slate-200">{connectionState}</span></p>
      <p>Local stream: <span className="text-slate-200">{localStreamReady ? "ready" : "not ready"}</span></p>
      <p>Remote stream: <span className="text-slate-200">{remoteStreamReady ? "receiving" : "not receiving"}</span></p>
      <p>Selected candidate: <span className="text-slate-200">{candidateType}</span></p>
     </div>
     {(permissionStatus.camera === "denied" || permissionStatus.microphone === "denied") && <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">Camera or microphone access is blocked. Click the lock/camera icon in the browser address bar, set both permissions to Allow, reload this page, then press the camera button again.</p>}
     {iceWarning && <p className="mt-3 text-xs text-amber-300">{iceWarning} Configure TURN for restrictive networks.</p>}
    {calibrated && <p className="mt-3 text-center text-xs text-slate-400">Calibration applied using real getUserMedia constraints.</p>}
  </div>;
}
