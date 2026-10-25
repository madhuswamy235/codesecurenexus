"use client";

import { useRef, useState } from "react";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";

type RecognitionResult = { 0: { 0: { transcript: string } } };
type RecognitionEvent = Event & { results: RecognitionResult };
type Recognition = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionConstructor = new () => Recognition;

const prompts = [
  "Tell me about a project where you solved a difficult technical problem.",
  "How would you design a reliable API for a growing application?",
  "Explain a time you received feedback and changed your approach.",
];

export default function LearningVoicePage() {
  const [index, setIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);

  function askQuestion() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(prompts[index]));
  }

  function startListening() {
    const browserWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const RecognitionApi = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!RecognitionApi) {
      setFeedback("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new RecognitionApi();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setFeedback(text.length > 80 ? "Strong answer length. Try adding one measurable result or lesson learned." : "Good start. Add context, your action, and the outcome to make the answer more convincing.");
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setFeedback("I could not hear that clearly. Check your microphone and try again."); };
    recognitionRef.current = recognition;
    setTranscript("");
    setFeedback("Listening... speak naturally for your answer.");
    setListening(true);
    recognition.start();
  }

  function nextQuestion() {
    recognitionRef.current?.stop();
    setListening(false);
    setIndex((current) => (current + 1) % prompts.length);
    setTranscript("");
    setFeedback("");
  }

  return <ProtectedWorkspace eyebrow="AI voice practice"><div className="mx-auto max-w-4xl space-y-6"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-600">AI learning coach</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Practice by talking</h1><p className="mt-2 text-slate-600">Hear an interview-style question, answer out loud, and get immediate structure feedback in your browser.</p></div><section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex items-center justify-between gap-4"><span className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-200">Question {index + 1} of {prompts.length}</span><span className={`text-xs font-semibold ${listening ? "text-emerald-300" : "text-slate-400"}`}>{listening ? "● Listening" : "Ready"}</span></div><h2 className="mt-8 text-2xl font-bold leading-tight sm:text-3xl">{prompts[index]}</h2><div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={askQuestion} className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-400">Ask question aloud</button><button type="button" onClick={startListening} disabled={listening} className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white hover:border-emerald-300 disabled:opacity-50">{listening ? "Listening..." : "Answer with microphone"}</button><button type="button" onClick={nextQuestion} className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-slate-300 hover:text-white">Next question</button></div></section><section className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Your answer</p><p className="mt-4 min-h-32 text-sm leading-7 text-slate-700">{transcript || "Your spoken answer will appear here."}</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Coach feedback</p><p className="mt-4 min-h-32 text-sm leading-7 text-emerald-900">{feedback || "Use the STAR structure: situation, task, action, and result."}</p></div></section></div></ProtectedWorkspace>;
}
