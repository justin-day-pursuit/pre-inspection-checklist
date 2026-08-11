/**
 * Server Actions for Gemini
 * -------------------------
 * Server Actions run on the server (safe for API keys) and can be
 * called from React components later when we wire up checklist generation.
 *
 * The address search page does NOT call these yet on purpose.
 */

"use server";

import { promptGemini } from "@/lib/gemini";

/**
 * Ask Gemini a question and return the text answer.
 * Call this from the UI only when you are ready to use AI features.
 */
export async function askGemini(prompt: string): Promise<{
  ok: boolean;
  text?: string;
  error?: string;
}> {
  // Basic guard: empty prompts are not useful and waste API calls
  const cleaned = prompt.trim();
  if (!cleaned) {
    return { ok: false, error: "Prompt cannot be empty." };
  }

  try {
    const text = await promptGemini(cleaned);
    return { ok: true, text };
  } catch (error) {
    // Keep the message readable for non-technical maintainers
    const message =
      error instanceof Error ? error.message : "Unknown Gemini error.";
    return { ok: false, error: message };
  }
}
