"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import AssessmentList from "@/components/assessment/AssessmentList";

export default function AssessmentPage() {
  return (
    <RequireAuth>
      <AssessmentList />
    </RequireAuth>
  );
}
