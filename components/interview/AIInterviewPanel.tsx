"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import api from "@/lib/api";

type Question = { questionId: string; question: string; category: string };
type Evaluation = {
  technicalScore: number;
  relevanceScore: number;
  communicationScore: number;
  confidenceScore: number;
  overallScore: number;
  feedback: string;
  mode: string;
};
type InterviewReport = {
  performanceScore: number;
  integrityScore: number;
  technicalScore: number;
  communicationScore: number;
  strengths?: string[];
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function subscribeToSpeechSupport() {
  return () => undefined;
}

function getSpeechSupport() {
  return typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function getServerSpeechSupport() {
  return false;
}

export default function AIInterviewPanel({ interviewId }: { interviewId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const voiceSupported = useSyncExternalStore(subscribeToSpeechSupport, getSpeechSupport, getServerSpeechSupport);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answerBeforeListeningRef = useRef("");

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text: string) {
    if (!("speechSynthesis" in window)) {
      setMessage("Spoken playback is not supported in this browser. You can still read the question.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onerror = () => setMessage("The browser could not play the spoken prompt.");
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage("Voice input is not supported in this browser. Please type your answer or use a recent version of Chrome or Edge.");
      return;
    }

    setMessage("");
    answerBeforeListeningRef.current = answer.trim();
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const finalParts: string[] = [];
      const interimParts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript.trim();
        if (!transcript) continue;
        (event.results[i].isFinal ? finalParts : interimParts).push(transcript);
      }
      const recognized = [...finalParts, ...interimParts].join(" ");
      setAnswer(
        [answerBeforeListeningRef.current, recognized].filter(Boolean).join(" ")
      );
    };
    recognition.onerror = (event) => {
      const reason =
        event.error === "not-allowed"
          ? "Microphone permission was denied. Allow microphone access in your browser, then try again."
          : event.error === "no-speech"
            ? "No speech was detected. Try speaking closer to your microphone."
            : `Voice recognition stopped (${event.error}). You can continue by typing your answer.`;
      setMessage(reason);
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (error) {
      recognitionRef.current = null;
      setListening(false);
      setMessage(error instanceof Error ? error.message : "Could not start microphone recognition.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post<{
        sessionId: string;
        firstQuestion: Question;
      }>("/ai-interview/start", {
        interviewId,
        role: "Software Engineer",
        difficulty: "Medium",
        topics: ["SecureNexus"],
      });
      const firstQuestion = response.data!.firstQuestion;
      setSessionId(response.data!.sessionId);
      setQuestion(firstQuestion);
      setQuestionNumber(1);
      setEvaluation(null);
      speak(firstQuestion.question);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the AI interview.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!sessionId || !question || !answer.trim()) return;
    if (listening) stopListening();
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post<{ evaluation: Evaluation }>("/ai-interview/evaluate", {
        sessionId,
        questionId: question.questionId,
        question: question.question,
        answer: answer.trim(),
        category: question.category,
      });
      setEvaluation(response.data!.evaluation);
      if (questionNumber === 5) {
        const reportResponse = await api.get<InterviewReport>(`/ai-interview/report/${sessionId}`);
        setReport(reportResponse.data || null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not evaluate the answer.");
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (!sessionId) return;
    if (listening) stopListening();
    setBusy(true);
    setMessage("");
    try {
      const response = await api.post<{ question: Question }>("/ai-interview/next-question", {
        sessionId,
      });
      setQuestion(response.data!.question);
      setQuestionNumber((value) => value + 1);
      setAnswer("");
      setEvaluation(null);
      speak(response.data!.question.question);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The next question is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-cyan-500/30 bg-slate-900 p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Live AI Interview</p>
          <h2 className="mt-1 text-xl font-semibold">SecureNexus AI Interviewer</h2>
        </div>
        <span className="text-xs text-emerald-300">{sessionId ? "● Ready" : "Not started"}</span>
      </div>

      {!question ? (
        <button
          className="mt-5 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
          onClick={start}
          disabled={busy}
        >
          {busy ? "Starting..." : "Start Voice Interview"}
        </button>
      ) : (
        <>
          <div className="mt-5 border-l-2 border-cyan-400 pl-4">
            <p className="text-xs text-slate-400">Question {questionNumber} of 5 · {question.category}</p>
            <p className="mt-2 text-lg">{question.question}</p>
            <button
              className="mt-3 rounded-lg border border-cyan-400/50 px-3 py-1.5 text-sm text-cyan-200 hover:bg-cyan-400/10"
              onClick={() => speak(question.question)}
              type="button"
            >
              Read question aloud
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">Your spoken answer</p>
                <p className="mt-1 text-xs text-slate-400">
                  {listening
                    ? "Listening… speak clearly, then stop recording."
                    : voiceSupported
                      ? "Allow microphone access to answer by voice."
                      : "Voice input is unavailable here; type your answer below."}
                </p>
              </div>
              {listening ? (
                <button
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white"
                  onClick={stopListening}
                  type="button"
                >
                  Stop microphone
                </button>
              ) : (
                <button
                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                  onClick={startListening}
                  disabled={!voiceSupported || busy || Boolean(evaluation)}
                  type="button"
                >
                  Start microphone
                </button>
              )}
            </div>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Your speech transcript appears here. You can also type or edit your answer."
              className="mt-4 min-h-28 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm outline-none focus:border-cyan-400"
              disabled={Boolean(evaluation)}
            />
          </div>

          {!evaluation ? (
            <button
              className="mt-3 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
              onClick={submit}
              disabled={busy || !answer.trim()}
            >
              {busy ? "Evaluating..." : "Submit Answer"}
            </button>
          ) : (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-300">
                Evaluation · {evaluation.overallScore}/100
              </p>
              <p className="mt-2 text-sm text-slate-200">{evaluation.feedback}</p>
              <button
                className="mt-3 text-sm text-cyan-200 underline"
                onClick={() => speak(evaluation.feedback)}
                type="button"
              >
                Read feedback aloud
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                <span>Technical {evaluation.technicalScore}%</span>
                <span>Communication {evaluation.communicationScore}%</span>
                <span>Relevance {evaluation.relevanceScore}%</span>
                <span>Confidence {evaluation.confidenceScore}%</span>
              </div>
              {questionNumber < 5 && (
                <button
                  className="mt-4 rounded-lg border border-cyan-400 px-4 py-2 text-sm text-cyan-200"
                  onClick={next}
                  disabled={busy}
                >
                  {busy ? "Loading..." : "Next Question"}
                </button>
              )}
            </div>
          )}
          {report && (
            <div className="mt-4 border-t border-slate-700 pt-4">
              <p className="text-sm font-semibold text-cyan-300">Final Interview Report</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <span>Performance {report.performanceScore}/100</span>
                <span>Integrity {report.integrityScore}/100</span>
                <span>Technical {report.technicalScore}/100</span>
                <span>Communication {report.communicationScore}/100</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                {report.strengths?.join(" ") || "Keep building structured answers."}
              </p>
            </div>
          )}
        </>
      )}

      {message && <p className="mt-3 text-sm text-amber-300" role="status">{message}</p>}
      <p className="mt-4 text-xs text-slate-500">
        Questions and feedback are spoken using your browser’s voice engine. Voice answers use browser speech recognition and are submitted as text; raw audio is not stored. Evaluation uses the configured backend or its clearly identified fallback.
      </p>
    </section>
  );
}
