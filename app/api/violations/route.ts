/**
 * Violations API Route
 * --------------------
 * Browser-safe entry point for address search.
 * The client posts an address here; this route calls NYC Open Data on the server
 * so App Token / password never appear in the browser.
 *
 * POST /api/violations
 * body: { "address": "350 5th Ave, New York, NY" }
 */

import { NextResponse } from "next/server";
import { searchOpenViolationsByAddress } from "@/lib/nyc-opendata";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
    const address = body.address?.trim() ?? "";

    if (!address) {
      return NextResponse.json(
        { status: "error", message: "Address is required." },
        { status: 400 },
      );
    }

    const result = await searchOpenViolationsByAddress(address);

    // Mirror typed statuses so the UI can show the right message
    if (result.status === "ok") {
      return NextResponse.json({
        status: "ok",
        violations: result.violations,
      });
    }

    if (result.status === "empty") {
      return NextResponse.json({ status: "empty" });
    }

    if (result.status === "timeout") {
      return NextResponse.json(
        { status: "timeout", message: "The search timed out" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message: result.message || "Error in getting data",
      },
      { status: 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // If something above aborted unexpectedly, treat it as a timeout
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { status: "timeout", message: "The search timed out" },
        { status: 504 },
      );
    }

    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}

/** Allow the route a little longer than the 30s NYC fetch timeout. */
export const maxDuration = 35;
