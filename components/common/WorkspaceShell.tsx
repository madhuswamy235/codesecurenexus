"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, FileText, LayoutDashboard, LogOut, Plus, Video } from "lucide-react";
import { canCreateInterviewsForRole, useAuth } from "@/hooks/useAuth";

const primaryLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/interview", label: "Interview room", icon: Video },
  { href: "/learning", label: "Learning center", icon: BookOpen },
  { href: "/interview/performance", label: "Performance", icon: BarChart3 },
  { href: "/interview/report", label: "Reports", icon: FileText },
];

export default function WorkspaceShell({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const canCreate = canCreateInterviewsForRole(user?.role);

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white px-4 py-6 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 font-black text-white">S</span><span><span className="block font-bold tracking-tight">Secure<span className="text-emerald-600">Nexus</span></span><span className="mt-0.5 block text-[11px] text-slate-400">{eyebrow || "Interview workspace"}</span></span></Link>
        <div className="mt-10"><p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p><nav className="mt-3 space-y-1">{primaryLinks.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={18} />{label}</Link>; })}</nav></div>
        {canCreate && <Link href="/recruiter/interviews" className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={17} /> Create interview</Link>}
        <div className="absolute bottom-6 left-4 right-4 rounded-2xl bg-slate-50 p-3"><p className="truncate text-sm font-semibold text-slate-800">{user?.name || "Workspace user"}</p><p className="mt-1 text-xs capitalize text-slate-500">{user?.role || "member"}</p><button onClick={() => { logout(); window.location.href = "/login"; }} className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-rose-600"><LogOut size={14} /> Sign out</button></div>
      </aside>
      <div className="lg:pl-64"><header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 px-4 py-4 backdrop-blur lg:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><Link href="/dashboard" className="flex items-center gap-3 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 font-black text-white">S</span><span className="font-bold">Secure<span className="text-emerald-600">Nexus</span></span></Link><p className="hidden text-sm text-slate-500 lg:block">{eyebrow || "Your interview workspace"}</p><div className="flex items-center gap-3"><span className="hidden text-sm font-medium text-slate-600 sm:block">{user?.name}</span><button onClick={() => { logout(); window.location.href = "/login"; }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-600 lg:hidden">Sign out</button></div></div><nav className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto lg:hidden">{primaryLinks.map(({ href, label }) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${pathname === href || pathname.startsWith(`${href}/`) ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>{label}</Link>)}</nav></header><main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main></div>
    </div>
  );
}
