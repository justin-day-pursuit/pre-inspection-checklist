/**
 * NYC Open Data helper (SODA3)
 * ----------------------------
 * Talks to the Open HPD Violations dataset on NYC Open Data.
 * This file must only run on the SERVER so App Token / password stay secret.
 *
 * Dataset view id: csn4-vhvf (already limited to open violations)
 * Protocol: SODA3 POST /api/v3/views/{id}/query.json
 */

import {
  classifyAddressInput,
  classifySuggestInput,
  normalizeHouseNumber,
  parseNycAddress,
  parseSuggestQuery,
} from "@/lib/address-query";
import type {
  AddressMatch,
  AddressSuggestResult,
  HpdViolation,
  ViolationsSearchResult,
} from "@/lib/violations-types";

export type {
  AddressMatch,
  AddressSuggestResult,
  HpdViolation,
  ViolationsSearchResult,
};

export {
  classifyAddressInput,
  classifySuggestInput,
  normalizeHouseNumber,
  parseNycAddress,
  parseSuggestQuery,
} from "@/lib/address-query";

/** Max unique buildings returned for one address-check call. */
const SUGGEST_PAGE_SIZE = 50;

const DEFAULT_ENDPOINT =
  "https://data.cityofnewyork.us/api/v3/views/csn4-vhvf/query.json";

/** Stop waiting for NYC Open Data after this many milliseconds. */
export const NYC_OPENDATA_TIMEOUT_MS = 10_000;

/** Max rows returned for one address search. */
const PAGE_SIZE = 500;

/** Escape a value so it is safe inside a single-quoted SoQL string. */
function escapeSoqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * SoQL house-number match that accepts hyphenated and de-hyphenated forms.
 * Example: user "35-01" also matches dataset value "3501", and vice versa when
 * the typed value itself contains a hyphen.
 */
function buildHouseNumberClause(houseNumber: string): string {
  const normalized = normalizeHouseNumber(houseNumber);
  const escaped = escapeSoqlLiteral(normalized);
  const withoutHyphen = escapeSoqlLiteral(normalized.replace(/-/g, ""));

  if (normalized.includes("-") && withoutHyphen !== escaped) {
    return `(\`housenumber\` = '${escaped}' OR \`housenumber\` = '${withoutHyphen}')`;
  }

  return `\`housenumber\` = '${escaped}'`;
}

/**
 * SoQL for the address-check call: find unique buildings that match what was typed.
 */
export function buildSuggestSoql(
  houseNumber: string,
  streetQuery: string | null,
  zip: string | null = null,
): string {
  const parts = [
    "SELECT `housenumber`, `streetname`, `boro`, `zip`",
    `WHERE ${buildHouseNumberClause(houseNumber)}`,
  ];

  if (streetQuery) {
    parts.push(
      `AND upper(\`streetname\`) LIKE '%${escapeSoqlLiteral(streetQuery)}%'`,
    );
  }

  if (zip) {
    parts.push(`AND \`zip\` = '${escapeSoqlLiteral(zip)}'`);
  }

  parts.push("ORDER BY `streetname` ASC NULL LAST");
  return parts.join(" ");
}

/** Pretty label for one building match in the dropdown. */
export function formatAddressMatchLabel(match: {
  houseNumber: string;
  streetName: string;
  borough: string;
  zip: string;
}): string {
  const street = `${match.houseNumber} ${match.streetName}`.trim();
  const place = [match.borough, match.zip ? `NY ${match.zip}` : ""]
    .filter(Boolean)
    .join(", ");
  return place ? `${street}, ${place}` : street;
}

/**
 * Build the SoQL query used by SODA3.
 * The view already excludes closed/dismissed violations.
 */
export function buildViolationsSoql(
  houseNumber: string,
  streetQuery: string,
  zip: string | null = null,
): string {
  const street = escapeSoqlLiteral(streetQuery);

  const parts = [
    "SELECT `violationid`, `ordernumber`, `class`, `novdescription`,",
    "`apartment`, `novissueddate`, `housenumber`, `streetname`, `boro`, `zip`",
    `WHERE ${buildHouseNumberClause(houseNumber)}`,
    `AND upper(\`streetname\`) LIKE '%${street}%'`,
  ];

  // Optional ZIP filter when the user included one in the search box
  if (zip) {
    parts.push(`AND \`zip\` = '${escapeSoqlLiteral(zip)}'`);
  }

  parts.push("ORDER BY `novissueddate` DESC NULL LAST");
  return parts.join(" ");
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

/** Map one SODA3 row into the HpdViolation shape used by the UI. */
function mapRowToViolation(row: Record<string, unknown>): HpdViolation | null {
  const violationId =
    readField(row, "violationid") ||
    readField(row, "ViolationID") ||
    `${readField(row, "ordernumber")}-${readField(row, "novdescription")}`;

  if (!violationId) return null;

  return {
    violationId,
    orderNumber: readField(row, "ordernumber") || readField(row, "OrderNumber"),
    // `class` is a reserved-ish field name in JS docs; HPD stores it as class
    violationClass: readField(row, "class") || readField(row, "Class"),
    description:
      readField(row, "novdescription") || readField(row, "NOVDescription"),
    apartment: readField(row, "apartment") || readField(row, "Apartment"),
    novIssuedDate:
      readField(row, "novissueddate") || readField(row, "NOVIssuedDate"),
    houseNumber: readField(row, "housenumber") || readField(row, "HouseNumber"),
    streetName: readField(row, "streetname") || readField(row, "StreetName"),
    borough: readField(row, "boro") || readField(row, "Borough"),
    zip: readField(row, "zip") || readField(row, "Postcode"),
  };
}

/** Deduplicate SODA rows into unique violations by violation id. */
function uniqueViolationsFromRows(
  rows: Record<string, unknown>[],
): HpdViolation[] {
  const byId = new Map<string, HpdViolation>();
  for (const row of rows) {
    const mapped = mapRowToViolation(row);
    if (!mapped || byId.has(mapped.violationId)) continue;
    byId.set(mapped.violationId, mapped);
  }
  return Array.from(byId.values());
}

/** True when an error message clearly means a timeout (not a client abort). */
export function isTimeoutErrorMessage(message: string): boolean {
  return /timeout|timed out/i.test(message);
}

/**
 * Combine AbortSignals. Uses native AbortSignal.any when available;
 * otherwise forwards aborts from any input onto a manual controller.
 */
function anyAbortSignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
    for (const signal of signals) {
      signal.removeEventListener("abort", onAbort);
    }
  };

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  return controller.signal;
}

/** Log fail states for maintainers watching the server terminal. Never log secrets. */
function logSearchFailure(
  kind: "timeout" | "error",
  address: string,
  detail?: string,
) {
  console.error("[violations-search]", {
    status: kind,
    address,
    detail: detail || null,
  });
}

function logSuggestFailure(
  kind: "timeout" | "error",
  address: string,
  detail?: string,
) {
  console.error("[address-suggest]", {
    status: kind,
    address,
    detail: detail || null,
  });
}

/**
 * Shared SODA3 POST with 10s timeout.
 * Optional externalSignal (e.g. request.signal) cancels the NYC fetch early.
 * Timer abort → timeout; external abort alone → aborted.
 */
async function postNycSoql(
  query: string,
  pageSize: number,
  logContext: string,
  externalSignal?: AbortSignal,
): Promise<
  | { status: "ok"; rows: Record<string, unknown>[] }
  | { status: "error"; message: string }
  | { status: "timeout" }
  | { status: "aborted" }
> {
  const { appToken, username, password, endpoint } = getNycOpenDataConfig();
  if (!appToken) {
    return {
      status: "error",
      message:
        "Missing NYC_OPENDATA_APP_TOKEN. Add your App Token to .env.local and restart the server.",
    };
  }

  // Already aborted before we start (client disconnected)
  if (externalSignal?.aborted) {
    return { status: "aborted" };
  }

  const timeoutController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, NYC_OPENDATA_TIMEOUT_MS);

  const signal = externalSignal
    ? anyAbortSignal([timeoutController.signal, externalSignal])
    : timeoutController.signal;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-App-Token": appToken,
    };

    if (username && password) {
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        page: { pageNumber: 1, pageSize },
        includeSynthetic: false,
      }),
      signal,
      cache: "no-store",
    });

    if (response.status === 408 || response.status === 504) {
      return { status: "timeout" };
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (
        isTimeoutErrorMessage(bodyText) ||
        isTimeoutErrorMessage(response.statusText)
      ) {
        return { status: "timeout" };
      }
      return {
        status: "error",
        message: `NYC Open Data returned HTTP ${response.status}.`,
      };
    }

    const payload: unknown = await response.json();
    return { status: "ok", rows: extractRows(payload) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // Timer fired → timeout; external cancel alone → aborted
      if (timedOut) {
        return { status: "timeout" };
      }
      if (externalSignal?.aborted) {
        return { status: "aborted" };
      }
      return { status: "timeout" };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isTimeoutErrorMessage(message)) {
      return { status: "timeout" };
    }
    return { status: "error", message: `${logContext}: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Address-check call: return unique buildings that match the typed text.
 * Used for the live suggestion list under the search bar.
 */
export async function suggestAddressesByQuery(
  query: string,
  signal?: AbortSignal,
): Promise<AddressSuggestResult> {
  const classified = classifySuggestInput(query);
  if (classified.status === "idle" || classified.status === "insufficient") {
    return { status: "insufficient" };
  }
  if (classified.status === "invalid") {
    return { status: "invalid" };
  }

  const result = await postNycSoql(
    buildSuggestSoql(
      classified.houseNumber,
      classified.streetQuery,
      classified.zip,
    ),
    SUGGEST_PAGE_SIZE,
    "address-suggest",
    signal,
  );

  if (result.status === "aborted") {
    return { status: "aborted" };
  }

  if (result.status === "timeout") {
    logSuggestFailure("timeout", query, "NYC Open Data timeout");
    return { status: "timeout" };
  }

  if (result.status === "error") {
    logSuggestFailure("error", query, result.message);
    return { status: "error", message: result.message };
  }

  // Deduplicate to one row per unique building
  const byId = new Map<string, AddressMatch>();
  for (const row of result.rows) {
    const houseNumber =
      readField(row, "housenumber") || readField(row, "HouseNumber");
    const streetName =
      readField(row, "streetname") || readField(row, "StreetName");
    const borough = readField(row, "boro") || readField(row, "Borough");
    const zip = readField(row, "zip") || readField(row, "Postcode");

    if (!houseNumber || !streetName) continue;

    const id = `${houseNumber}|${streetName}|${borough}|${zip}`.toUpperCase();
    if (byId.has(id)) continue;

    byId.set(id, {
      id,
      houseNumber,
      streetName,
      borough,
      zip,
      label: formatAddressMatchLabel({
        houseNumber,
        streetName,
        borough,
        zip,
      }),
    });
  }

  const matches = Array.from(byId.values());
  if (matches.length === 0) {
    return { status: "empty" };
  }

  return { status: "ok", matches };
}

/**
 * Search open HPD violations for a typed NYC address.
 * Uses a 10-second AbortController so the call cannot hang forever.
 */
export async function searchOpenViolationsByAddress(
  address: string,
  signal?: AbortSignal,
): Promise<ViolationsSearchResult> {
  const classified = classifyAddressInput(address);
  if (classified.status === "idle" || classified.status === "insufficient") {
    return { status: "insufficient" };
  }
  if (classified.status === "invalid") {
    return { status: "invalid" };
  }

  const result = await postNycSoql(
    buildViolationsSoql(
      classified.houseNumber,
      classified.streetQuery,
      classified.zip,
    ),
    PAGE_SIZE,
    "violations-search",
    signal,
  );

  if (result.status === "aborted") {
    return { status: "aborted" };
  }

  if (result.status === "timeout") {
    logSearchFailure("timeout", address, "NYC Open Data timeout");
    return { status: "timeout" };
  }

  if (result.status === "error") {
    logSearchFailure("error", address, result.message);
    return { status: "error", message: result.message };
  }

  // Deduplicate by violation id so each unique violation appears once
  const violations = uniqueViolationsFromRows(result.rows);
  if (violations.length === 0) {
    return { status: "empty" };
  }

  return { status: "ok", violations };
}

/**
 * Exact building lookup used after the user clicks a suggested address.
 * Uses the HPD streetname as-is (already normalized in the dataset).
 */
export async function searchOpenViolationsByBuilding(
  match: {
    houseNumber: string;
    streetName: string;
    zip?: string;
  },
  signal?: AbortSignal,
): Promise<ViolationsSearchResult> {
  const addressLabel = formatAddressMatchLabel({
    houseNumber: match.houseNumber,
    streetName: match.streetName,
    borough: "",
    zip: match.zip || "",
  });

  const result = await postNycSoql(
    buildViolationsSoql(
      match.houseNumber,
      match.streetName.toUpperCase(),
      match.zip || null,
    ),
    PAGE_SIZE,
    "violations-search",
    signal,
  );

  if (result.status === "aborted") {
    return { status: "aborted" };
  }

  if (result.status === "timeout") {
    logSearchFailure("timeout", addressLabel, "NYC Open Data timeout");
    return { status: "timeout" };
  }

  if (result.status === "error") {
    logSearchFailure("error", addressLabel, result.message);
    return { status: "error", message: result.message };
  }

  const violations = uniqueViolationsFromRows(result.rows);
  if (violations.length === 0) {
    return { status: "empty" };
  }

  return { status: "ok", violations };
}
