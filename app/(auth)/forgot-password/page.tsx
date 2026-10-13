"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {

  const [email, setEmail] = useState("");

  return (

    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">

      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8">

        <div className="text-center">

          <h1 className="text-4xl font-bold text-cyan-400">
            Forgot Password
          </h1>

          <p className="text-slate-400 mt-3">
            Recover your SecureNexus account securely.
          </p>

        </div>

        <div className="mt-8">

          <label className="text-white">
            Registered Email
          </label>

          <input
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-white"
            placeholder="Enter registered email"
          />

        </div>
        <div className="mt-8 space-y-4">

          <button
            className="w-full rounded-xl bg-cyan-600 py-3 font-semibold hover:bg-cyan-700"
          >
            Send OTP
          </button>


          <button
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            Recover using Security Questions
          </button>

          <button
            className="w-full rounded-xl bg-green-600 py-3 font-bold hover:bg-green-700"
          >
            AI Assisted Account Recovery
          </button>

          <p className="text-center text-slate-400 mt-4">
            Remember your password? Login instead
          </p>

        </div>

      </div>

    </div>

  );
}