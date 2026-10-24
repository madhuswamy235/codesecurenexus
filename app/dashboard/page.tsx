"use client";

import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import InterviewDashboard from "@/components/dashboard/InterviewDashboard";

export default function DashboardPage() {
  return (
    <ProtectedWorkspace eyebrow="Your overview">
      <InterviewDashboard />
    </ProtectedWorkspace>
  );
}
