/**
 * NYC Open Data helper (SODA3)
 * ----------------------------
 * Talks to the Open HPD Violations dataset on NYC Open Data.
 * This file must only run on the SERVER so App Token / password stay secret.
 *
 * Dataset view id: csn4-vhvf (already limited to open violations)
 * Protocol: SODA3 POST /api/v3/views/{id}/query.json
 */

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

/** Max unique buildings returned for one address-check call. */
const SUGGEST_PAGE_SIZE = 50;

const DEFAULT_ENDPOINT =
  "https://data.cityofnewyork.us/api/v3/views/csn4-vhvf/query.json";

/** Stop waiting for NYC Open Data after this many milliseconds. */
export const NYC_OPENDATA_TIMEOUT_MS = 30_000;

/** Max rows returned for one address search. */
const PAGE_SIZE = 500;

/**
 * Expand common street-type shorthands to the full words HPD usually stores.
 * Example: "AVE" → "AVENUE", "ST" → "STREET", "PL" → "PLACE"
 */
const STREET_TYPE_EXPANSIONS: Array<[RegExp, string]> = [
  [/\b(STREET|STR|ST)\b/g, "STREET"],
  [/\b(AVENUE|AVE)\b/g, "AVENUE"],
  [/\b(PLACE|PL)\b/g, "PLACE"],
  [/\b(ROAD|RD)\b/g, "ROAD"],
  [/\b(BOULEVARD|BLVD)\b/g, "BOULEVARD"],
  [/\b(DRIVE|DR)\b/g, "DRIVE"],
  [/\b(LANE|LN)\b/g, "LANE"],
  [/\b(COURT|CT)\b/g, "COURT"],
  [/\b(PARKWAY|PKWY)\b/g, "PARKWAY"],
  [/\b(HIGHWAY|HWY)\b/g, "HIGHWAY"],
  [/\b(SQUARE|SQ)\b/g, "SQUARE"],
  [/\b(TERRACE|TERR|TER)\b/g, "TERRACE"],
];

/**
 * Turn ordinal street numbers into plain numbers so they match HPD names.
 * Example: "18TH" → "18", "2ND" → "2", "1ST" → "1"
 */
function normalizeOrdinals(street: string): string {
  return street.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
}

/**
 * Expand street-type abbreviations to full words (HPD-friendly).
 */
function expandStreetTypes(street: string): string {
  let result = street;
  for (const [pattern, fullWord] of STREET_TYPE_EXPANSIONS) {
    result = result.replace(pattern, fullWord);
  }
  return result;
}

/**
 * Split a typed address into house number + street text (+ optional ZIP).
 * Example: "7011 18th Ave 11204" → house "7011", street "18 AVENUE", zip "11204"
 */
export function parseNycAddress(rawAddress: string): {
  houseNumber: string;
  streetQuery: string;
  zip: string | null;
} | null {
  const cleaned = rawAddress.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  // Capture a trailing ZIP when the user typed one (used as an optional SoQL filter)
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : null;

  // Drop trailing city / state / ZIP noise before reading house + street
  const withoutCityState = cleaned
    .replace(/,?\s*(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b.*$/i, "")
    .replace(/,?\s*ny\s*\d{5}(-\d{4})?$/i, "")
    .replace(/\s+\d{5}(-\d{4})?$/i, "")
    .trim();

  const match = withoutCityState.match(/^(\d+[A-Za-z\-\/]?)\s+(.+)$/);
  if (!match) return null;

  const houseNumber = match[1].trim();

  // Build a street query that looks like HPD streetname values
  const streetQuery = expandStreetTypes(
    normalizeOrdinals(
      match[2]
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!houseNumber || !streetQuery) return null;
  return { houseNumber, streetQuery, zip };
}

/**
 * Looser parse for the live address-check list (while the user is still typing).
 * Allows house number only, or house + partial street text.
 */
export function parseSuggestQuery(rawAddress: string): {
  houseNumber: string;
  streetQuery: string | null;
  zip: string | null;
} | null {
  const cleaned = rawAddress.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : null;

  const withoutCityState = cleaned
    .replace(/,?\s*(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b.*$/i, "")
    .replace(/,?\s*ny\s*\d{5}(-\d{4})?$/i, "")
    .replace(/\s+\d{5}(-\d{4})?$/i, "")
    .trim();

  // House number only (user still typing the street)
  const houseOnly = withoutCityState.match(/^(\d+[A-Za-z\-\/]?)$/);
  if (houseOnly) {
    return { houseNumber: houseOnly[1], streetQuery: null, zip };
  }

  const match = withoutCityState.match(/^(\d+[A-Za-z\-\/]?)\s+(.+)$/);
  if (!match) return null;

  const houseNumber = match[1].trim();
  const streetQuery = expandStreetTypes(
    normalizeOrdinals(
      match[2]
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!houseNumber) return null;
  return { houseNumber, streetQuery: streetQuery || null, zip };
}

/** Escape a value so it is safe inside a single-quoted SoQL string. */
function escapeSoqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * SoQL for the address-check call: find unique buildings that match what was typed.
 */
export function buildSuggestSoql(
  houseNumber: string,
  streetQuery: string | null,
  zip: string | null = null,
): string {
  const house = escapeSoqlLiteral(houseNumber);
  const parts = [
    "SELECT `housenumber`, `streetname`, `boro`, `zip`",
    `WHERE \`housenumber\` = '${house}'`,
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
  const house = escapeSoqlLiteral(houseNumber);
  const street = escapeSoqlLiteral(streetQuery);

  const parts = [
    "SELECT `violationid`, `ordernumber`, `class`, `novdescription`,",
    "`apartment`, `novissueddate`, `housenumber`, `streetname`, `boro`, `zip`",
    `WHERE \`housenumber\` = '${house}'`,
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

/** True when an error message clearly means a timeout. */
export function isTimeoutErrorMessage(message: string): boolean {
  return /timeout|timed out|aborted|abort/i.test(message);
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
 * Shared SODA3 POST with 30s timeout.
 * Returns raw rows, or a typed fail status.
 */
async function postNycSoql(
  query: string,
  pageSize: number,
  logContext: string,
): Promise<
  | { status: "ok"; rows: Record<string, unknown>[] }
  | { status: "error"; message: string }
  | { status: "timeout" }
> {
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
      signal: controller.signal,
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
): Promise<AddressSuggestResult> {
  const parsed = parseSuggestQuery(query);
  if (!parsed) {
    return { status: "empty" };
  }

  const result = await postNycSoql(
    buildSuggestSoql(parsed.houseNumber, parsed.streetQuery, parsed.zip),
    SUGGEST_PAGE_SIZE,
    "address-suggest",
  );

  if (result.status === "timeout") {
    logSuggestFailure("timeout", query, "Abort or gateway timeout");
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
 * Uses a 30-second AbortController so the call cannot hang forever.
 */
export async function searchOpenViolationsByAddress(
  address: string,
): Promise<ViolationsSearchResult> {
  const parsed = parseNycAddress(address);
  if (!parsed) {
    return { status: "empty" };
  }

  const result = await postNycSoql(
    buildViolationsSoql(parsed.houseNumber, parsed.streetQuery, parsed.zip),
    PAGE_SIZE,
    "violations-search",
  );

  if (result.status === "timeout") {
    logSearchFailure("timeout", address, "Abort or gateway timeout");
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
export async function searchOpenViolationsByBuilding(match: {
  houseNumber: string;
  streetName: string;
  zip?: string;
}): Promise<ViolationsSearchResult> {
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
  );

  if (result.status === "timeout") {
    logSearchFailure("timeout", addressLabel, "Abort or gateway timeout");
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
