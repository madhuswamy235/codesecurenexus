"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/interview", label: "Interview" },
  { href: "/learning", label: "Learning" },
  { href: "/interview/performance", label: "Performance" },
  { href: "/interview/report", label: "Reports" },
];

export default function WorkspaceShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 font-black text-slate-950">S</span>
            <span>
              <span className="block text-sm font-bold tracking-wide">SecureNexus</span>
              <span className="hidden text-xs text-slate-500 sm:block">{eyebrow || "Secure interview platform"}</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {primaryLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm transition ${active ? "bg-emerald-400/15 text-emerald-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{link.label}</Link>;
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 lg:block">{user?.name || "Candidate"}</span>
            <button onClick={() => { logout(); window.location.href = "/login"; }} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-red-400/50 hover:text-red-300">Logout</button>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto md:hidden">
          {primaryLinks.map((link) => <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300">{link.label}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
