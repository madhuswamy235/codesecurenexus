import { NextResponse } from "next/server";

/**
 * MCQ submission proxy.
 *
 * SecureNexus's real submission + scoring engine lives on the Express backend
 * (POST /api/assessments/mcq/submit). This Next.js route is kept as a thin
 * compatibility shim that forwards the request (and the candidate's JWT) to
 * the backend, so the score is computed server-side rather than faked in the
 * browser. The mongoose models previously imported here are unused and remain
 * untouched on disk.
 */

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      interviewId,
      candidateId,
      questionId,
      answers,
    } = body;

    if (!interviewId || !answers) {
      return NextResponse.json(
        { success: false, error: "interviewId and answers are required" },
        { status: 400 }
      );
    }

    const forwarded = await fetch(`${API_URL}/assessments/mcq/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.get("authorization")
          ? { Authorization: req.headers.get("authorization") as string }
          : {}),
      },
      body: JSON.stringify({ interviewId, questionId, answers }),
    });

    const json = await forwarded.json().catch(() => ({}));

    return NextResponse.json(json, { status: forwarded.status });

  } catch (error) {
    console.error("MCQ proxy error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "MCQ submission failed",
      },
      { status: 500 }
    );
  }
}