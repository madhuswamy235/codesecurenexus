"use client";

import { AlertTriangle, Shield } from "lucide-react";
import type { InterviewRoomController } from "@/hooks/useInterviewRoom";

export default function SecurityAlert({ room }: { room: InterviewRoomController }) {
  const events = room.liveSecurity || [];
  const summary = room.securitySummary as Record<string, unknown> | null;
  const tabSwitches = typeof summary?.tabSwitchCount === "number"
    ? summary.tabSwitchCount
    : events.filter((event) => event.eventType === "TAB_SWITCH").length;
  const nearbyDevices = typeof summary?.nearbyDeviceCount === "number"
    ? summary.nearbyDeviceCount
    : events
      .filter((event) => event.eventType === "NEARBY_DEVICE_DETECTED")
      .reduce((total, event) => total + (Number(event.details?.nearbyDeviceCount) || 1), 0);
  const multipleFaceIncidentCount = typeof summary?.multipleFaceIncidentCount === "number"
    ? summary.multipleFaceIncidentCount
    : events.filter((event) => event.eventType === "MULTIPLE_FACE_DETECTED").length;
  const suspiciousActivityCount = typeof summary?.suspiciousActivityCount === "number"
    ? summary.suspiciousActivityCount
    : events.filter((event) => event.eventType === "SUSPICIOUS_ACTIVITY").length;
  const unexpectedParticipantCount = typeof summary?.unexpectedParticipantCount === "number"
    ? summary.unexpectedParticipantCount
    : events.filter((event) => event.eventType === "UNEXPECTED_PARTICIPANT").length;
  const hasCritical = events.some((event) => event.severity === "CRITICAL");
  const cameraIdleCount = typeof summary?.cameraIdleCount === "number"
    ? summary.cameraIdleCount
    : events.filter((event) => event.eventType === "CAMERA_IDLE").length;
  const totalEvents = typeof summary?.totalEvents === "number" ? summary.totalEvents : events.length;
  const cameraObscuredCount = typeof summary?.cameraObscuredCount === "number"
    ? summary.cameraObscuredCount
    : events.filter((event) => event.eventType === "CAMERA_OBSCURED").length;

  return (
    <div className="rounded-xl bg-slate-900 p-5 shadow-lg">
      <h2 className="mb-5 text-xl font-bold text-cyan-400">Live Security Monitor</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><AlertTriangle className="text-amber-400" size={18} /><span>Browser tab switches</span></div><span className="text-amber-300">{tabSwitches}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><Shield className="text-cyan-400" size={18} /><span>BLE scan reports</span></div><span className="text-cyan-300">{nearbyDevices}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><Shield className="text-amber-400" size={18} /><span>Multiple-face review incidents</span></div><span className="text-amber-300">{multipleFaceIncidentCount}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><AlertTriangle className="text-orange-400" size={18} /><span>Repeated tab-switch warnings</span></div><span className="text-orange-300">{suspiciousActivityCount}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><AlertTriangle className="text-red-400" size={18} /><span>Unexpected participants</span></div><span className="text-red-300">{unexpectedParticipantCount}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><AlertTriangle className="text-orange-400" size={18} /><span>Camera idle alerts</span></div><span className="text-orange-300">{cameraIdleCount}</span></div>
        <div className="flex items-center justify-between rounded-lg bg-slate-800 p-3"><div className="flex items-center gap-3"><AlertTriangle className="text-orange-400" size={18} /><span>Camera obscured / no-face alerts</span></div><span className="text-orange-300">{cameraObscuredCount}</span></div>
      <div className={`flex items-center justify-between rounded-lg bg-slate-800 p-3 ${hasCritical ? "ring-1 ring-red-500/50" : ""}`}><div className="flex items-center gap-3"><Shield className="text-emerald-500" size={18} /><span>Security events logged</span></div><span className="text-emerald-300">{totalEvents}</span></div>
      </div>
      <p className="mt-4 text-[11px] text-slate-500">Face-count incidents are automatic local, approximate review signals only. The detector does not identify people or analyze gaze.</p>
    </div>
  );
}
