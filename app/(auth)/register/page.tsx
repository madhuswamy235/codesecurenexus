"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, homeForRole } from "@/hooks/useAuth";

export default function RegisterPage() {

  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateAccount = async () => {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const user = await register({ name: fullName, email, password, mobile });
      const next = new URLSearchParams(window.location.search).get("next");
      const target = next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : homeForRole(user.role);
      router.push(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">

      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-8">

        <div className="text-center">

          <h1 className="text-4xl font-bold text-cyan-400">
            SecureNexus
          </h1>

          <p className="text-slate-400 mt-2">
            Create Your AI Interview Account
          </p>

        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-700 bg-red-900/40 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 mt-8">

          <div>

            <label className="text-white">
              Full Name
            </label>

            <input
              value={fullName}
              onChange={(e)=>setFullName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white"
              placeholder="Enter full name"
            />

          </div>

          <div>

            <label className="text-white">
              Email
            </label>

            <input
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white"
              placeholder="Enter email"
            />

          </div>

          <div>

            <label className="text-white">
              Mobile Number
            </label>

            <input
              value={mobile}
              onChange={(e)=>setMobile(e.target.value)}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white"
              placeholder="Enter mobile"
            />

          </div>

          <div>

            <label className="text-white">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white"
              placeholder="Create password"
            />

          </div>
          <div>

            <label className="text-white">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-white"
              placeholder="Confirm password"
            />

          </div>

        </div>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3">

            <input
              type="checkbox"
              id="terms"
              className="h-4 w-4"
            />

            <label
              htmlFor="terms"
              className="text-slate-300"
            >
              I agree to the Terms & Conditions and Privacy Policy.
            </label>

          </div>

          <button
            onClick={handleCreateAccount}
            disabled={loading}
            className="w-full rounded-xl bg-green-600 py-3 font-bold hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <button
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            Continue with Google
          </button>

          <p className="text-center text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-400 hover:underline">
              Login
            </Link>
          </p>

        </div>

      </div>

    </div>

  );
}