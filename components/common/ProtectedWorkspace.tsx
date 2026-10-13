"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import WorkspaceShell from "./WorkspaceShell";

export default function ProtectedWorkspace({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return <RequireAuth><WorkspaceShell eyebrow={eyebrow}>{children}</WorkspaceShell></RequireAuth>;
}
