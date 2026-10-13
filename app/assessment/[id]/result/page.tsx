"use client";

import { useParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import AssessmentResult from "@/components/assessment/AssessmentResult";

export default function AssessmentResultPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  return (
    <RequireAuth>
      {id ? <AssessmentResult interviewId={id} /> : null}
    </RequireAuth>
  );
}
