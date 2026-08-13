/**
 * Violations API Route
 * --------------------
 * Browser-safe entry point for address search.
 * The client posts an address here; this route calls NYC Open Data on the server
 * so App Token / password never appear in the browser.
 *
 * Called after the user picks a match from the address-check list.
 *
 * POST /api/violations
 * body:
 *   { "address": "7011 18 AVENUE 11204" }
 *   OR
 *   { "houseNumber": "7011", "streetName": "18 AVENUE", "zip": "11204" }
 */

import { NextResponse } from "next/server";
import {
  CONNECTION_TIMED_OUT_MESSAGE,
  INVALID_SEARCH_MESSAGE,
  TOO_LITTLE_INFORMATION_MESSAGE,
} from "@/lib/address-query";
import {
  searchOpenViolationsByAddress,
  searchOpenViolationsByBuilding,
} from "@/lib/nyc-opendata";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      houseNumber?: string;
      streetName?: string;
      zip?: string;
    };

    const houseNumber = body.houseNumber?.trim() ?? "";
    const streetName = body.streetName?.trim() ?? "";
    const zip = body.zip?.trim() ?? "";
    const address = body.address?.trim() ?? "";

    const result =
      houseNumber && streetName
        ? await searchOpenViolationsByBuilding(
            {
              houseNumber,
              streetName,
              zip: zip || undefined,
            },
            request.signal,
          )
        : address
          ? await searchOpenViolationsByAddress(address, request.signal)
          : null;

    if (!result) {
      console.error("[violations-search] error", {
        address: "",
        detail: "Address is required.",
      });
      return NextResponse.json(
        { status: "error", message: "Address is required." },
        { status: 400 },
      );
    }

    const logAddress =
      houseNumber && streetName
        ? `${houseNumber} ${streetName}${zip ? ` ${zip}` : ""}`
        : address;

    if (result.status === "ok") {
      return NextResponse.json({
        status: "ok",
        violations: result.violations,
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

    if (result.status === "aborted") {
      return NextResponse.json({ status: "aborted" }, { status: 499 });
    }

    if (result.status === "timeout") {
      console.error("[violations-search] timeout", {
        address: logAddress,
        message: CONNECTION_TIMED_OUT_MESSAGE,
      });
      return NextResponse.json(
        { status: "timeout", message: CONNECTION_TIMED_OUT_MESSAGE },
        { status: 504 },
      );
    }

    console.error("[violations-search] error", {
      address: logAddress,
      message: result.message || "Error in getting data",
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
      return NextResponse.json({ status: "aborted" }, { status: 499 });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[violations-search] error", {
      address: "(unknown)",
      message,
    });
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

/** Allow the route a little longer than the 10s NYC fetch timeout. */
export const maxDuration = 15;
