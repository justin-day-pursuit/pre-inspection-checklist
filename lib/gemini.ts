/**
 * Gemini AI helper
 * -----------------
 * This file talks to Google's Gemini model from the SERVER only.
 * Do not import this into browser/client components — that would
 * risk exposing your API key.
 *
 * Setup:
 * 1. Copy `.env.example` to `.env.local`
 * 2. Paste your key into GEMINI_API_KEY=
 * 3. Restart `npm run dev` after changing env files
 */

import { GoogleGenAI } from "@google/genai";

/** The model we use for this project (fast + capable for checklist work). */
export const GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Creates a Gemini client using the key from `.env.local`.
 * Throws a clear error if the key is missing so setup mistakes are obvious.
 */
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Copy .env.example to .env.local and add your key.",
    );
  }

  // apiKey stays on the server — never send it to the browser
  return new GoogleGenAI({ apiKey });
}

/**
 * Send a plain-text prompt to Gemini and return the text reply.
 *
 * Example (from a Server Action or API Route):
 *   const reply = await promptGemini("List move-out inspection items for a NYC kitchen.");
 */
export async function promptGemini(prompt: string): Promise<string> {
  const ai = getGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  // response.text is the model's plain-text answer
  return response.text ?? "";
}
