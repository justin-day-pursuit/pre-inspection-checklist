/**
 * NYC Open Data helper (SODA3)
 * ----------------------------
 * Talks to the Open HPD Violations dataset on NYC Open Data.
 * This file must only run on the SERVER so App Token / password stay secret.
 *
 * Dataset view id: csn4-vhvf (already limited to open violations)
 * Protocol: SODA3 POST /api/v3/views/{id}/query.json
 */

import type { HpdViolation, ViolationsSearchResult } from "@/lib/violations-types";

export type { HpdViolation, ViolationsSearchResult };

const DEFAULT_ENDPOINT =
  "https://data.cityofnewyork.us/api/v3/views/csn4-vhvf/query.json";

/** Stop waiting for NYC Open Data after this many milliseconds. */
export const NYC_OPENDATA_TIMEOUT_MS = 30_000;

/** Max rows returned for one address search. */
const PAGE_SIZE = 500;

/**
 * Split a typed address into house number + street text.
 * Example: "350 5th Ave, New York, NY 10118" → house "350", street "5TH AVE"
 */
export function parseNycAddress(rawAddress: string): {
  houseNumber: string;
  streetQuery: string;
} | null {
  const cleaned = rawAddress.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  // Drop trailing ", City, ST ZIP" style suffixes when present
  const withoutCityState = cleaned
    .replace(/,?\s*(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b.*$/i, "")
    .replace(/,?\s*ny\s*\d{5}(-\d{4})?$/i, "")
    .replace(/\s+\d{5}(-\d{4})?$/i, "")
    .trim();

  const match = withoutCityState.match(/^(\d+[A-Za-z\-\/]?)\s+(.+)$/);
  if (!match) return null;

  const houseNumber = match[1].trim();
  // Uppercase street text for SoQL LIKE matching against HPD streetname values
  const streetQuery = match[2]
    .trim()
    .toUpperCase()
    // Soften common abbreviations so "5TH AVE" can still match "5 AVENUE"-ish text
    .replace(/\b(STREET|ST)\b/g, "")
    .replace(/\b(AVENUE|AVE)\b/g, "")
    .replace(/\b(BOULEVARD|BLVD)\b/g, "")
    .replace(/\b(ROAD|RD)\b/g, "")
    .replace(/\b(PLACE|PL)\b/g, "")
    .replace(/\b(DRIVE|DR)\b/g, "")
    .replace(/\b(LANE|LN)\b/g, "")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!houseNumber || !streetQuery) return null;
  return { houseNumber, streetQuery };
}

/** Escape a value so it is safe inside a single-quoted SoQL string. */
function escapeSoqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build the SoQL query used by SODA3.
 * The view already excludes closed/dismissed violations.
 */
export function buildViolationsSoql(houseNumber: string, streetQuery: string): string {
  const house = escapeSoqlLiteral(houseNumber);
  const street = escapeSoqlLiteral(streetQuery);

  return [
    "SELECT `violationid`, `ordernumber`, `novdescription`, `approveddate`,",
    "`housenumber`, `streetname`, `boro`, `zip`",
    `WHERE \`housenumber\` = '${house}'`,
    `AND upper(\`streetname\`) LIKE '%${street}%'`,
    "ORDER BY `approveddate` DESC NULL LAST",
  ].join(" ");
}

/**
 * Read env settings for NYC Open Data.
 * App Token is required by SODA3. Username/password are optional Basic Auth.
 */
function getNycOpenDataConfig() {
  const appToken = process.env.NYC_OPENDATA_APP_TOKEN?.trim() ?? "";
  const username = process.env.NYC_OPENDATA_USERNAME?.trim() ?? "";
  const password = process.env.NYC_OPENDATA_PASSWORD?.trim() ?? "";
  const endpoint =
    process.env.NYC_OPENDATA_BASE_URL?.trim() || DEFAULT_ENDPOINT;

  return { appToken, username, password, endpoint };
}

/** Pull a string field out of a SODA3 row (handles a few response shapes). */
function readField(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  // Some SODA payloads nest values as { value: ... }
  if (typeof value === "object" && value !== null && "value" in value) {
    const nested = (value as { value: unknown }).value;
    return nested == null ? "" : String(nested);
  }
  return "";
}

/**
 * Normalize SODA3 JSON into a flat list of rows.
 * SODA3 may return an array, or an object with `data` / `rows`.
 */
function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.rows)) return obj.rows as Record<string, unknown>[];
  }
  return [];
}

/** True when an error message clearly means a timeout. */
export function isTimeoutErrorMessage(message: string): boolean {
  return /timeout|timed out|aborted|abort/i.test(message);
}

/**
 * Search open HPD violations for a typed NYC address.
 * Uses a 30-second AbortController so the call cannot hang forever.
 */
export async function searchOpenViolationsByAddress(
  address: string,
): Promise<ViolationsSearchResult> {
  const parsed = parseNycAddress(address);
  if (!parsed) {
    return { status: "empty" };
  }

  const { appToken, username, password, endpoint } = getNycOpenDataConfig();
  if (!appToken) {
    return {
      status: "error",
      message:
        "Missing NYC_OPENDATA_APP_TOKEN. Add your App Token to .env.local and restart the server.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NYC_OPENDATA_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-App-Token": appToken,
    };

    // Optional Basic Auth if the user filled in NYC Open Data account credentials
    if (username && password) {
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: buildViolationsSoql(parsed.houseNumber, parsed.streetQuery),
        page: { pageNumber: 1, pageSize: PAGE_SIZE },
        includeSynthetic: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    // Treat common gateway timeout statuses as a timed-out search
    if (response.status === 408 || response.status === 504) {
      return { status: "timeout" };
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (isTimeoutErrorMessage(bodyText) || isTimeoutErrorMessage(response.statusText)) {
        return { status: "timeout" };
      }
      return {
        status: "error",
        message: `NYC Open Data returned HTTP ${response.status}.`,
      };
    }

    const payload: unknown = await response.json();
    const rows = extractRows(payload);

    // Deduplicate by violation id so each unique violation appears once
    const byId = new Map<string, HpdViolation>();
    for (const row of rows) {
      const violationId =
        readField(row, "violationid") ||
        readField(row, "ViolationID") ||
        `${readField(row, "ordernumber")}-${readField(row, "novdescription")}`;

      if (!violationId || byId.has(violationId)) continue;

      byId.set(violationId, {
        violationId,
        orderNumber: readField(row, "ordernumber") || readField(row, "OrderNumber"),
        description:
          readField(row, "novdescription") || readField(row, "NOVDescription"),
        originalCreationDate:
          readField(row, "approveddate") || readField(row, "ApprovedDate"),
        houseNumber: readField(row, "housenumber") || readField(row, "HouseNumber"),
        streetName: readField(row, "streetname") || readField(row, "StreetName"),
        borough: readField(row, "boro") || readField(row, "Borough"),
        zip: readField(row, "zip") || readField(row, "Postcode"),
      });
    }

    const violations = Array.from(byId.values());
    if (violations.length === 0) {
      return { status: "empty" };
    }

    return { status: "ok", violations };
  } catch (error) {
    // AbortController fires when we hit the 30-second limit
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "timeout" };
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (isTimeoutErrorMessage(message)) {
      return { status: "timeout" };
    }

    return { status: "error", message };
  } finally {
    clearTimeout(timer);
  }
}
