"use client";
import { useSearchParams } from "next/navigation";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import AssessmentRunner from "@/components/assessment/AssessmentRunner";
function AssessmentSurface() { const params = useSearchParams(); const id = params.get("id") || "demo-interview"; return <AssessmentRunner interviewId={id} />; }
export default function InterviewAssessmentPage() { return <ProtectedWorkspace eyebrow="Interview assessment"><AssessmentSurface /></ProtectedWorkspace>; }
