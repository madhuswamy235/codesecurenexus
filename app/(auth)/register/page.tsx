"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { resolveDestination, sanitizeNext } from "@/lib/auth-nav";

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const isInterviewInvite = next?.startsWith("/interview/join/") ?? false;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!acceptedTerms) return setError("Please accept the terms and privacy policy to continue.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      const user = await register({ name: fullName.trim(), email: email.trim(), password, mobile: mobile.trim() });
      router.push(resolveDestination(next, user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">SecureNexus</p>
          <h1 className="mt-3 text-3xl font-bold">Create your candidate account</h1>
          <p className="mt-2 text-sm text-slate-400">It takes less than a minute to get ready for your interview.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          {isInterviewInvite && (
            <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">Your interview link is saved</p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/70">After registration, you’ll return directly to this invitation and can join the lobby.</p>
            </div>
          )}
          {error && <div role="alert" className="mb-6 rounded-xl border border-red-600/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

          <form onSubmit={handleCreateAccount} className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="register-name" className="text-sm font-medium text-slate-200">Full name</label>
              <input id="register-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="Your full name" autoComplete="name" required />
            </div>
            <div>
              <label htmlFor="register-email" className="text-sm font-medium text-slate-200">Email address</label>
              <input id="register-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="you@example.com" autoComplete="email" required />
            </div>
            <div>
              <label htmlFor="register-mobile" className="text-sm font-medium text-slate-200">Mobile number <span className="text-slate-500">(optional)</span></label>
              <input id="register-mobile" value={mobile} onChange={(event) => setMobile(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="Optional" autoComplete="tel" />
            </div>
            <div>
              <label htmlFor="register-password" className="text-sm font-medium text-slate-200">Password</label>
              <input id="register-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="At least 8 characters" autoComplete="new-password" required />
            </div>
            <div>
              <label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-200">Confirm password</label>
              <input id="register-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" placeholder="Repeat your password" autoComplete="new-password" required />
            </div>

            <div className="space-y-4 sm:col-span-2">
              <label htmlFor="terms" className="flex items-start gap-3 text-sm text-slate-300">
                <input id="terms" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
                <span>I agree to the Terms & Conditions and Privacy Policy.</span>
              </label>
              <button type="submit" disabled={loading} className="w-full rounded-xl bg-cyan-500 py-3 font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60">
                {loading ? "Creating your account…" : isInterviewInvite ? "Create account and continue" : "Create account"}
              </button>
              <p className="text-center text-sm text-slate-400">Already have an account? <Link href={loginHref} className="font-semibold text-cyan-300 hover:underline">Sign in and continue</Link></p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={null}><RegisterForm /></Suspense>;
}
