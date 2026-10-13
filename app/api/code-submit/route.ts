import { NextResponse } from "next/server";

/**
 * Code submission proxy.
 *
 * SecureNexus's real grading + persistence lives on the Express backend
 * (POST /api/assessments/code/submit). This Next.js route is a thin
 * compatibility shim that forwards the request (and the candidate's JWT) to the
 * backend so the submission is genuinely evaluated and stored — never faked
 * in the browser.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { candidateId, questionId, interviewId, language, code } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Code cannot be empty",
        },
        {
          status: 400,
        }
      );
    }

    const forwarded = await fetch(`${API_URL}/assessments/code/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify({ interviewId, questionId, language, code, candidateId }),
    });

    const json = await forwarded.json().catch(() => ({}));
    return NextResponse.json(json, { status: forwarded.status });
  } catch (error) {
    console.error("Code submit proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error",
      },
      {
        status: 500,
      }
    );
  }
}