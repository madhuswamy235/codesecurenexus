"use client";

import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-5">

      <div>
        <label className="text-sm text-gray-300">
          Email or Mobile Number
        </label>

        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email or mobile number"
          className="mt-2 w-full rounded-xl bg-[#111827] border border-gray-700 px-4 py-3 text-white outline-none focus:border-green-400"
        />
      </div>


      <div>
        <label className="text-sm text-gray-300">
          Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="mt-2 w-full rounded-xl bg-[#111827] border border-gray-700 px-4 py-3 text-white outline-none focus:border-purple-400"
        />
      </div>


      <button
        className="w-full rounded-xl bg-gradient-to-r from-green-500 to-purple-600 py-3 font-semibold text-white hover:scale-[1.02] transition"
      >
        Continue Secure Login
      </button>

    </div>
  );
}