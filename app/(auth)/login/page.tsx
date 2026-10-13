"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, homeForRole } from "@/hooks/useAuth";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);
      // Redirect back to the originally requested (protected) destination if
      // one was captured by RequireAuth (?next=...), otherwise use the
      // role-based default home.
      const next = searchParams.get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : homeForRole(user.role);
      router.push(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 shadow-xl">

        <h1 className="text-3xl font-bold text-center mb-2">
          SecureNexus
        </h1>

        <p className="text-center text-gray-400 mb-8">
          AI Powered Secure Interview Platform
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/40 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800/40 p-3 text-xs text-gray-400">
          <p className="font-semibold text-gray-300">Dev / demo accounts</p>
          <p className="mt-1">
            Admin — <span className="text-gray-200">admin@securenexus.dev</span> /{" "}
            <span className="text-gray-200">admin123</span>
          </p>
          <p>
            Candidate — <span className="text-gray-200">candidate@securenexus.dev</span> /{" "}
            <span className="text-gray-200">candidate123</span>
          </p>
          <p className="mt-1">
            Recruiter — <span className="text-gray-200">recruiter@securenexus.dev</span> /{" "}
            <span className="text-gray-200">recruiter123</span>
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          <div>
            <label className="block mb-2">
              Email
            </label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-600 p-3 outline-none"
              required
            />
          </div>


          <div>
            <label className="block mb-2">
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-600 p-3 outline-none"
              required
            />
          </div>


          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </button>

        </form>


        <div className="my-6 flex items-center gap-3">
          <div className="h-px bg-gray-700 flex-1"></div>
          <span className="text-gray-400">OR</span>
          <div className="h-px bg-gray-700 flex-1"></div>
        </div>


          <p className="text-center text-gray-400 mt-6">
          New user?{" "}
          <Link href="/register" className="text-blue-400 hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/forgot-password" className="text-gray-500 hover:text-gray-300">
            Forgot password?
          </Link>
          <Link href="/" className="text-gray-500 hover:text-gray-300">
            Back home
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static prerendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}