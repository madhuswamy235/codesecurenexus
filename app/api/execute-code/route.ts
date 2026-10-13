import { NextResponse } from "next/server";

/**
 * Code execution proxy.
 *
 * SecureNexus's real execution engine lives on the Express backend
 * (POST /api/assessments/code/run). This Next.js route is a thin compatibility
 * shim that forwards the request (and the candidate's JWT) to the backend, so
 * execution is performed by the DEV_EXECUTOR server-side — never fabricated in
 * the browser. If the backend has no execution service, it says so honestly.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { language, code, input } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Code is empty",
        },
        {
          status: 400,
        }
      );
    }

    const forwarded = await fetch(`${API_URL}/assessments/code/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify({ language, code, input }),
    });

    const json = await forwarded.json().catch(() => ({}));
    return NextResponse.json(json, { status: forwarded.status });
  } catch (error) {
    console.error("Code execution proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Execution server error",
      },
      {
        status: 500,
      }
    );
  }
}