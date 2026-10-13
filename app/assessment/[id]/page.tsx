"use client";

import { useParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import AssessmentRunner from "@/components/assessment/AssessmentRunner";

export default function AssessmentRunPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  return (
    <RequireAuth>
      {id ? <AssessmentRunner interviewId={id} /> : null}
    </RequireAuth>
  );
}
