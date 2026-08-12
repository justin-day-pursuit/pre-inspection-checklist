/**
 * Address suggest / check API
 * ---------------------------
 * While the user types, the client calls this route to list unique buildings
 * that match the partial address in Open HPD Violations.
 *
 * POST /api/addresses/suggest
 * body: { "query": "7011 18" }
 */

import { NextResponse } from "next/server";
import { suggestAddressesByQuery } from "@/lib/nyc-opendata";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ status: "empty" });
    }

    const result = await suggestAddressesByQuery(query);

    if (result.status === "ok") {
      return NextResponse.json({
        status: "ok",
        matches: result.matches,
      });
    }

    if (result.status === "empty") {
      return NextResponse.json({ status: "empty" });
    }

    if (result.status === "timeout") {
      console.error("[address-suggest] timeout", { query });
      return NextResponse.json(
        { status: "timeout", message: "The search timed out" },
        { status: 504 },
      );
    }

    console.error("[address-suggest] error", {
      query,
      message: result.message,
    });
    return NextResponse.json(
      {
        status: "error",
        message: result.message || "Error in getting data",
      },
      { status: 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[address-suggest] error", { message });
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export const maxDuration = 35;
