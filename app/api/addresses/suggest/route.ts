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
import {
  CONNECTION_TIMED_OUT_MESSAGE,
  INVALID_SEARCH_MESSAGE,
  TOO_LITTLE_INFORMATION_MESSAGE,
} from "@/lib/address-query";
import { suggestAddressesByQuery } from "@/lib/nyc-opendata";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = body.query?.trim() ?? "";

    if (!query) {
      return NextResponse.json({
        status: "insufficient",
        message: TOO_LITTLE_INFORMATION_MESSAGE,
      });
    }

    const result = await suggestAddressesByQuery(query, request.signal);

    if (result.status === "ok") {
      return NextResponse.json({
        status: "ok",
        matches: result.matches,
      });
    }

    if (result.status === "empty") {
      return NextResponse.json({ status: "empty" });
    }

    if (result.status === "insufficient") {
      return NextResponse.json(
        { status: "insufficient", message: TOO_LITTLE_INFORMATION_MESSAGE },
        { status: 400 },
      );
    }

    if (result.status === "invalid") {
      return NextResponse.json(
        { status: "invalid", message: INVALID_SEARCH_MESSAGE },
        { status: 400 },
      );
    }

    if (result.status === "timeout") {
      console.error("[address-suggest] timeout", { query });
      return NextResponse.json(
        { status: "timeout", message: CONNECTION_TIMED_OUT_MESSAGE },
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
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[address-suggest] timeout", {
        query: "(unknown)",
        message: "AbortError",
      });
      return NextResponse.json(
        { status: "timeout", message: CONNECTION_TIMED_OUT_MESSAGE },
        { status: 504 },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[address-suggest] error", { message });
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

/** Allow the route a little longer than the 10s NYC fetch timeout. */
export const maxDuration = 15;
