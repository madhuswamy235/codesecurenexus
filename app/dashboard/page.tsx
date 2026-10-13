"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import InterviewDashboard from "@/components/dashboard/InterviewDashboard";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <InterviewDashboard />
    </RequireAuth>
  );
}