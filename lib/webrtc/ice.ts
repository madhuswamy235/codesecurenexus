import api from "@/lib/api";

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServerResponse {
  iceServers: IceServerConfig[];
  turnConfigured: boolean;
  warning: string | null;
}

const fallbackIceServers: IceServerConfig[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export async function loadIceServers(): Promise<IceServerResponse> {
  try {
    const response = await api.get<IceServerResponse>("/webrtc/ice-servers");
    const data = response.data;
    if (data?.iceServers?.length) return data;
  } catch {
    // Keep the existing STUN path usable if configuration cannot be loaded.
  }

  return {
    iceServers: fallbackIceServers,
    turnConfigured: false,
    warning: "TURN configuration could not be loaded; restrictive NAT environments may require a TURN server.",
  };
}

export function describeMediaError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera or microphone permission was denied. Allow access in the browser address bar, then retry.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera or microphone was found. Connect a device and retry.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera or microphone is busy or unavailable. Close other apps using it, then retry.";
  }
  if (name === "OverconstrainedError") {
    return "The selected camera or microphone cannot satisfy the requested settings. Try again with another device.";
  }
  if (name === "TypeError") {
    return "Camera access requires HTTPS or localhost and a browser with media-device support.";
  }
  return error instanceof Error ? error.message : "Unable to access the camera and microphone.";
}

export async function queryMediaPermission(
  kind: "camera" | "microphone"
): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    return (await navigator.permissions.query({ name: kind } as PermissionDescriptor)).state;
  } catch {
    return "unsupported";
  }
}

export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    return await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
}
