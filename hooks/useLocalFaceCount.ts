"use client";

import { useEffect, useState, type RefObject } from "react";

const MODEL_PATH = "/models/blaze_face_short_range.tflite";
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const SCAN_INTERVAL_MS = 700;
const MULTIPLE_FACE_CONFIRMATIONS = 2;
const MAX_REPORTED_FACE_COUNT = 20;

export type LocalFaceCountStatus = "idle" | "loading" | "active" | "unavailable";
export type LocalFaceFraming = "unknown" | "no-face" | "centered" | "off-center";

type UseLocalFaceCountOptions = {
  enabled: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onMultipleFaces: (faceCount: number) => Promise<unknown> | unknown;
  onCameraObscured?: () => Promise<unknown> | unknown;
};

export function useLocalFaceCount({ enabled, videoRef, onMultipleFaces, onCameraObscured = () => undefined }: UseLocalFaceCountOptions) {
  const [status, setStatus] = useState<LocalFaceCountStatus>("idle");
  const [faceCount, setFaceCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [framing, setFraming] = useState<LocalFaceFraming>("unknown");

  useEffect(() => {
    if (!enabled) {
      const resetTimer = window.setTimeout(() => {
        setStatus("idle");
        setFaceCount(null);
        setFraming("unknown");
        setError("");
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    let timer: number | undefined;
    let detector: import("@mediapipe/tasks-vision").FaceDetector | null = null;
    let previousVideoTime = -1;
    let consecutiveMultipleSamples = 0;
    let reportedThisEpisode = false;
    let consecutiveNoFaceSamples = 0;
    let reportedNoFaceThisEpisode = false;

    async function start() {
      try {
        await Promise.resolve();
        if (cancelled) return;
        setStatus("loading");
        setFaceCount(null);
        setFraming("unknown");
        setError("");
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
        // Monaco uses an AMD loader. MediaPipe's WASM bootstrap also detects
        // AMD, so temporarily hide Monaco's globals while the WASM script is
        // loaded to prevent two anonymous define() registrations colliding.
        const scriptGlobal = globalThis as unknown as Record<string, unknown>;
        const savedDefine = scriptGlobal.define;
        const savedRequire = scriptGlobal.require;
        try {
          delete scriptGlobal.define;
          delete scriptGlobal.require;
          const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
          const nextDetector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: MODEL_PATH,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.6,
          });

          if (cancelled) return;

          detector = nextDetector;
          setStatus("active");
          scan();
        } finally {
          if (savedDefine !== undefined) scriptGlobal.define = savedDefine;
          if (savedRequire !== undefined) scriptGlobal.require = savedRequire;
        }
      } catch {
        if (!cancelled) {
          setStatus("unavailable");
          setError("Local face counting could not start. Check your connection and browser support; the interview can continue without it.");
        }
      }
    }

    function scan() {
      if (cancelled) return;
      const video = videoRef.current;

      if (detector && video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== previousVideoTime) {
        try {
          const result = detector.detectForVideo(video, performance.now());
          previousVideoTime = video.currentTime;
          const count = Math.min(result.detections.length, MAX_REPORTED_FACE_COUNT);
          setFaceCount((current) => current === count ? current : count);
          const primary = result.detections[0]?.boundingBox;
          if (!primary) setFraming("no-face");
          else {
            const center = (primary.originX + primary.width / 2) / video.videoWidth;
            setFraming(center >= 0.3 && center <= 0.7 ? "centered" : "off-center");
          }

          if (count >= 2) {
            consecutiveMultipleSamples += 1;
            if (consecutiveMultipleSamples >= MULTIPLE_FACE_CONFIRMATIONS && !reportedThisEpisode) {
              reportedThisEpisode = true;
              Promise.resolve(onMultipleFaces(count)).catch(() => {
                if (!cancelled) setError("A multi-face review event could not be saved. Local face counting is still active.");
              });
            }
          } else {
            consecutiveMultipleSamples = 0;
            reportedThisEpisode = false;
          }
          if (count === 0) {
            consecutiveNoFaceSamples += 1;
            if (consecutiveNoFaceSamples >= 3 && !reportedNoFaceThisEpisode) {
              reportedNoFaceThisEpisode = true;
              Promise.resolve(onCameraObscured()).catch(() => {
                if (!cancelled) setError("A camera-obscured review event could not be saved.");
              });
            }
          } else {
            consecutiveNoFaceSamples = 0;
            reportedNoFaceThisEpisode = false;
          }
        } catch {
          if (!cancelled) {
            setStatus("unavailable");
            setError("Local face counting stopped unexpectedly. The interview can continue without it.");
          }
          return;
        }
      }

      timer = window.setTimeout(scan, SCAN_INTERVAL_MS);
    }

    void start();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      // MediaPipe's browser detector does not expose a stable close API across
      // versions. Cancellation stops all future scans without calling it.
    };
  }, [enabled, onCameraObscured, onMultipleFaces, videoRef]);

  return { status, faceCount, framing, error };
}
