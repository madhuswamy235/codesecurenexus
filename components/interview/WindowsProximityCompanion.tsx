"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COMPANION_BASE_URL = "http://127.0.0.1:47853";
const COMPANION_DOWNLOAD = "/proximity-companion/Start-ProximityCompanion.ps1";
const CHECK_INTERVAL_MS = 2000;

interface CompanionResponse {
  success?: boolean;
  companion?: string;
  paired?: boolean;
  status?: string;
  activeDeviceCount?: number;
  totalFound?: number;
  windowSeconds?: number;
  error?: string;
  message?: string;
}

async function companionRequest(path: string, init?: RequestInit): Promise<CompanionResponse> {
  const response = await fetch(`${COMPANION_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    mode: "cors",
    credentials: "omit",
  });
  const payload = await response.json() as CompanionResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `Windows companion returned HTTP ${response.status}.`);
  }
  return payload;
}

export default function WindowsProximityCompanion({
  sessionId,
  onNewDevices,
}: {
  sessionId: string;
  onNewDevices: (count: number) => Promise<unknown> | unknown;
}) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pairingCode, setPairingCode] = useState("");
  const [paired, setPaired] = useState(false);
  const [scanStatus, setScanStatus] = useState("not-connected");
  const [activeDeviceCount, setActiveDeviceCount] = useState(0);
  const [windowSeconds, setWindowSeconds] = useState(15);
  const [message, setMessage] = useState("Checking for the Windows companion...");
  const [busy, setBusy] = useState(false);
  const lastReportedCount = useRef(0);
  const onNewDevicesRef = useRef(onNewDevices);

  useEffect(() => {
    onNewDevicesRef.current = onNewDevices;
  }, [onNewDevices]);

  const checkPairedStatus = useCallback(async () => {
    const result = await companionRequest(
      `/status?sessionId=${encodeURIComponent(sessionId)}`
    );
    setPaired(true);
    setAvailable(true);
    setScanStatus(result.status || "scanning");
    setActiveDeviceCount(result.activeDeviceCount || 0);
    setWindowSeconds(result.windowSeconds || 15);
    setMessage(result.error || "Connected to the Windows Bluetooth companion.");
    const totalFound = result.totalFound || 0;
    if (totalFound > lastReportedCount.current) {
      const newCount = totalFound - lastReportedCount.current;
      lastReportedCount.current = totalFound;
      await onNewDevicesRef.current(newCount);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    async function detectCompanion() {
      try {
        const health = await companionRequest("/health");
        if (!active) return;
        setAvailable(Boolean(health.companion));
        try {
          await checkPairedStatus();
        } catch {
          if (active) {
            setPaired(false);
            setMessage("Windows companion detected. Pair it with this interview using the code in its PowerShell window.");
          }
        }
      } catch (err) {
        if (active) {
          setAvailable(false);
          setMessage(err instanceof Error
            ? "Windows companion not detected. Download and run the companion, then allow local-network access when prompted."
            : "Windows companion not detected.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }
    void detectCompanion();
    return () => {
      active = false;
    };
  }, [checkPairedStatus]);

  useEffect(() => {
    if (!paired || !sessionId) return;
    const timer = window.setInterval(() => {
      void checkPairedStatus().catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Lost connection to the Windows companion.");
        setPaired(false);
      });
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [checkPairedStatus, paired, sessionId]);

  async function pairCompanion(event: React.FormEvent) {
    event.preventDefault();
    const code = pairingCode.trim().toLowerCase();
    if (!/^[0-9a-f]{24}$/.test(code)) {
      setMessage("Enter the 24-character pairing code shown in the Windows companion window.");
      return;
    }

    setBusy(true);
    setMessage("Pairing with the Windows companion...");
    lastReportedCount.current = 0;
    try {
      const response = await companionRequest("/pair", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ pairingCode: code, sessionId }),
      });
      setPaired(Boolean(response.paired));
      setAvailable(true);
      setPairingCode("");
      setScanStatus(response.status || "scanning");
      setMessage(response.error || "Paired. Waiting for nearby Bluetooth LE advertisements.");
      await checkPairedStatus();
    } catch (err) {
      setMessage(err instanceof Error
        ? `${err.message} Check the code and confirm local-network access in the browser.`
        : "Unable to pair with the Windows companion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-100">Windows Bluetooth proximity companion</p>
          <p className={`mt-1 text-xs ${activeDeviceCount > 0 ? "text-amber-300" : "text-slate-400"}`}>
            {paired
              ? scanStatus === "scanning"
                ? `${activeDeviceCount} advertising BLE device(s) detected in the last ${windowSeconds} seconds`
                : `Companion scan status: ${scanStatus}`
              : checking
                ? "Checking local companion..."
                : message}
          </p>
        </div>
        {!paired && (
          <a
            href={COMPANION_DOWNLOAD}
            download
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
          >
            Download Windows companion
          </a>
        )}
      </div>

      {!paired && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-400">
          <li>Download the PowerShell file and run it on this Windows computer.</li>
          <li>Approve the browser&apos;s local-network access prompt if shown.</li>
          <li>Enter the one-time code printed in the companion window.</li>
        </ol>
      )}

      {!paired && available && (
        <form onSubmit={(event) => void pairCompanion(event)} className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor={`companion-code-${sessionId}`}>Windows companion pairing code</label>
          <input
            id={`companion-code-${sessionId}`}
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.trim().toLowerCase())}
            autoComplete="off"
            spellCheck={false}
            maxLength={24}
            placeholder="24-character pairing code"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={busy || checking}
            className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
          >
            {busy ? "Pairing..." : "Pair and scan"}
          </button>
        </form>
      )}

      {paired && activeDeviceCount > 0 && (
        <p role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
          Nearby Bluetooth signals were detected. Please check that no unapproved devices are being used, or discuss the result with the interviewer. This is an approximate signal count—not proof of a device, identity, or exact distance.
        </p>
      )}
      {!checking && !available && (
        <p role="status" className="mt-3 text-xs text-slate-400">
          If this is an HTTPS site, allow its local-network permission. The companion only binds to this computer&apos;s loopback interface.
        </p>
      )}
      {paired && message && scanStatus !== "scanning" && (
        <p role={scanStatus === "unavailable" ? "alert" : "status"} className={`mt-3 text-xs ${scanStatus === "unavailable" ? "text-amber-300" : "text-slate-400"}`}>
          {message}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Scans Bluetooth LE advertisements using Windows and counts signals at roughly −70 dBm or stronger. This is only an approximate proximity indicator—not a measured 2-meter boundary. Non-advertising devices, Wi-Fi devices, and other radios cannot be detected. No device names or Bluetooth addresses are sent to SecureNexus.
      </p>
    </section>
  );
}
