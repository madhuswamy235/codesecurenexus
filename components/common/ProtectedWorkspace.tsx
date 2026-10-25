"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import WorkspaceShell from "./WorkspaceShell";

export default function ProtectedWorkspace({ children, eyebrow, dark = false }: { children: React.ReactNode; eyebrow?: string; dark?: boolean }) {
  return <RequireAuth><WorkspaceShell eyebrow={eyebrow} dark={dark}>{children}</WorkspaceShell></RequireAuth>;
}
