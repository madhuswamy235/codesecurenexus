"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, homeForRole } from "@/hooks/useAuth";
import { sanitizeNext } from "@/lib/auth-nav";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const isInterviewInvite = next?.startsWith("/interview/join/") ?? false;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      router.push(next || homeForRole(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">SecureNexus</p>
          <h1 className="mt-3 text-3xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to continue to your interview workspace.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          {isInterviewInvite && (
            <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <p className="text-sm font-semibold text-cyan-100">You’re joining an interview</p>
              <p className="mt-1 text-xs leading-5 text-cyan-100/70">After signing in, we’ll take you straight back to the invitation.</p>
            </div>
          )}

          {error && <div role="alert" className="mb-6 rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
              <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" required />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <input id="login-password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" required />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
              {loading ? "Signing in…" : isInterviewInvite ? "Sign in and continue" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800 pt-6 text-center text-sm text-slate-400">
            <p>New here? <Link href={registerHref} className="font-semibold text-cyan-300 hover:underline">Create a candidate account</Link></p>
            <div className="mt-4 flex justify-center gap-4 text-xs">
              <Link href={next ? `/forgot-password?next=${encodeURIComponent(next)}` : "/forgot-password"} className="hover:text-slate-200">Forgot password?</Link>
              <Link href="/" className="hover:text-slate-200">Back home</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
