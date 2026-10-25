"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, FileText, LayoutDashboard, LogOut, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview", label: "Interview", icon: Video },
  { href: "/learning", label: "Learning", icon: BookOpen },
  { href: "/interview/performance", label: "Performance", icon: BarChart3 },
  { href: "/interview/report", label: "Reports", icon: FileText },
];

export default function WorkspaceShell({ children, eyebrow, dark = false }: { children: React.ReactNode; eyebrow?: string; dark?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <div className={`min-h-screen ${dark ? "bg-[#07111f] text-white" : "bg-[#f7faf9] text-slate-950"}`}>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-64 border-r px-4 py-6 lg:block ${dark ? "border-slate-800 bg-[#0b1728]" : "border-slate-200 bg-white"}`}>
        <Link href="/dashboard" className="flex items-center gap-3 px-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 font-black text-white">S</span><span><span className="block font-bold tracking-tight">Secure<span className="text-emerald-600">Nexus</span></span><span className="mt-0.5 block text-[11px] text-slate-400">{eyebrow || "Interview workspace"}</span></span></Link>
        <div className="mt-10"><p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p><nav className="mt-3 space-y-1">{primaryLinks.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? (dark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (dark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")}`}><Icon size={18} />{label}</Link>; })}</nav></div>
        <div className={`absolute bottom-6 left-4 right-4 rounded-2xl p-3 ${dark ? "bg-white/5" : "bg-slate-50"}`}><p className={`truncate text-sm font-semibold ${dark ? "text-white" : "text-slate-800"}`}>{user?.name || "Workspace user"}</p><p className="mt-1 text-xs capitalize text-slate-500">{user?.role || "member"}</p><button onClick={() => { logout(); window.location.href = "/login"; }} className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-rose-400"><LogOut size={14} /> Sign out</button></div>
      </aside>
      <div className="lg:pl-64"><header className={`sticky top-0 z-30 border-b px-4 py-4 backdrop-blur lg:px-8 ${dark ? "border-slate-800/90 bg-[#07111f]/90" : "border-slate-200/90 bg-white/90"}`}><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><Link href="/dashboard" className="flex items-center gap-3 lg:hidden"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500 font-black text-white">S</span><span className="font-bold">Secure<span className="text-emerald-600">Nexus</span></span></Link><p className={`hidden text-sm lg:block ${dark ? "text-slate-400" : "text-slate-500"}`}>{eyebrow || "Your interview workspace"}</p><div className="flex items-center gap-3"><span className={`hidden text-sm font-medium sm:block ${dark ? "text-slate-300" : "text-slate-600"}`}>{user?.name}</span><button onClick={() => { logout(); window.location.href = "/login"; }} className={`rounded-xl border px-3 py-2 text-sm font-semibold lg:hidden ${dark ? "border-slate-700 text-slate-300 hover:border-rose-400 hover:text-rose-300" : "border-slate-200 text-slate-600 hover:border-rose-200 hover:text-rose-600"}`}>Sign out</button></div></div><nav className="mx-auto mt-3 flex max-w-7xl gap-2 overflow-x-auto lg:hidden">{primaryLinks.map(({ href, label }) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${pathname === href || pathname.startsWith(`${href}/`) ? "bg-emerald-500/15 text-emerald-300" : (dark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500")}`}>{label}</Link>)}</nav></header><main className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</main></div>
    </div>
  );
}
