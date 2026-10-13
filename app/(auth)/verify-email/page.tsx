"use client";

import { useState, useEffect } from "react";

export default function VerifyEmailPage() {

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(120);

  useEffect(() => {

    const interval = setInterval(() => {

      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });

    }, 1000);

    return () => clearInterval(interval);

  }, []);

  return (

    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">

      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8">

        <h1 className="text-4xl font-bold text-center text-cyan-400">
          Verify Email
        </h1>

        <p className="text-center text-slate-400 mt-3">
          Enter the 6-digit OTP sent to your email.
        </p>

        <div className="mt-8">

          <label className="text-white">
            OTP
          </label>

          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            maxLength={6}
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-center text-2xl tracking-[12px] text-white"
            placeholder="000000"
          />

        </div>
        <div className="mt-8 space-y-4">

          <button
            className="w-full rounded-xl bg-cyan-600 py-3 font-bold hover:bg-cyan-700"
          >
            Verify Email
          </button>

          <button
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 font-semibold hover:bg-slate-700"
          >
            Resend OTP
          </button>

          <div className="rounded-xl bg-slate-800 p-4">

            <div className="flex justify-between">

              <span className="text-slate-300">
                OTP Expires In
              </span>

              <span className="font-bold text-yellow-400">
                {timer} sec
              </span>

            </div>

          </div>

          <div className="rounded-xl bg-slate-800 p-4">

            <div className="flex justify-between">

              <span className="text-slate-300">
                AI Security Verification
              </span>

              <span className="font-bold text-green-400">
                Active
              </span>

            </div>

          </div>

          <p className="text-center text-slate-400">
            Didn&apos;t receive the code? Click <b>Resend OTP</b>.
          </p>

        </div>

      </div>

    </div>

  );
}