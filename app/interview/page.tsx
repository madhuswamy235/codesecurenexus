"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InterviewRoom from "@/components/interview/InterviewRoom";

function InterviewRoute() {
  const searchParams = useSearchParams();
  return <InterviewRoom interviewId={searchParams.get("id") || undefined} />;
}

export default function InterviewPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><InterviewRoute /></Suspense>;
}
