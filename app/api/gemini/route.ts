/**
 * Gemini API Route
 * ----------------
 * Alternative to Server Actions: call Gemini with a normal HTTP POST.
 * Useful for testing with curl or for non-React clients.
 *
 * Example:
 *   curl -X POST http://localhost:3000/api/gemini \
 *     -H "Content-Type: application/json" \
 *     -d '{"prompt":"Say hello"}'
 *
 * The address search UI does NOT call this yet.
 */

import { NextResponse } from "next/server";
import { promptGemini } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim() ?? "";

    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "Missing prompt in request body." },
        { status: 400 },
      );
    }

    const text = await promptGemini(prompt);
    return NextResponse.json({ ok: true, text });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Gemini error.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
