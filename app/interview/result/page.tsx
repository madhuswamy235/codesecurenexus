"use client";

import RequireAuth from "@/components/auth/RequireAuth";

export default function ResultPage() {
  return (
    <RequireAuth>
      <h1 className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-2xl">
        RESULT PAGE WORKING
      </h1>
    </RequireAuth>
  );
}