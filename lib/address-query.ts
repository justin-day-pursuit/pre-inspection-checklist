/**
 * Client-safe address parsing / classification
 * --------------------------------------------
 * Pure helpers shared by the browser form and the server Open Data layer.
 * Keep this free of env vars, fetch, and other server-only APIs.
 */

/** Minimum trimmed length before we classify / call suggest. */
export const MIN_QUERY_LENGTH = 2;

/** Street fragment must be at least this long to search Open Data. */
export const MIN_STREET_QUERY_LENGTH = 2;

export const CONNECTION_TIMED_OUT_MESSAGE = "Connection timed out";
export const INVALID_SEARCH_MESSAGE = "Invalid search";
export const TOO_LITTLE_INFORMATION_MESSAGE = "Too little information";

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
 * House-number token used at the start of an address.
 * Supports plain ("7011"), letter suffix ("7011A"), and hyphenated Queens-style ("35-01", "35-01A").
 */
const HOUSE_NUMBER_PATTERN = String.raw`\d+(?:-\d+)?[A-Za-z]?`;

/**
 * Turn ordinal street numbers into plain numbers so they match HPD names.
 * Example: "18TH" → "18", "2ND" → "2", "1ST" → "1"
 */
function normalizeOrdinals(street: string): string {
  return street.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
}

/**
 * Normalize NYC building / house numbers, including Queens-style hyphens.
 * Examples:
 *   "35 - 01" → "35-01"
 *   "35-01a"  → "35-01A"
 *   "7011-A"  → "7011A"
 *   "7011"    → "7011"
 */
export function normalizeHouseNumber(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    // Remove spaces around hyphens: "35 - 01" → "35-01"
    .replace(/\s*-\s*/g, "-")
    // Letter-only suffix after a hyphen (rare typing): "7011-A" → "7011A"
    .replace(/-([A-Z])$/g, "$1")
    // Collapse any leftover internal spaces inside the house token
    .replace(/\s+/g, "");
}

/**
 * Clean an address string before house/street splitting.
 * Joins spaced hyphens in building numbers: "35 - 01 35 Ave" → "35-01 35 Ave"
 */
function preprocessAddressInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(\d)\s*-\s*(\d)/g, "$1-$2")
    .replace(/(\d)\s*-\s*([A-Za-z])\b/g, "$1$2");
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

/** Normalize street text the way HPD streetname values usually look. */
function normalizeStreetQuery(rawStreet: string): string {
  return expandStreetTypes(
    normalizeOrdinals(
      rawStreet
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
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
  const cleaned = preprocessAddressInput(rawAddress);
  if (!cleaned) return null;

  // Capture a trailing ZIP when the user typed one (used as an optional SoQL filter)
  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : null;

  // Drop trailing city / state / ZIP noise before reading house + street
  const withoutCityState = cleaned
    .replace(
      /,?\s*(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b.*$/i,
      "",
    )
    .replace(/,?\s*ny\s*\d{5}(-\d{4})?$/i, "")
    .replace(/\s+\d{5}(-\d{4})?$/i, "")
    .trim();

  const match = withoutCityState.match(
    new RegExp(`^(${HOUSE_NUMBER_PATTERN})\\s+(.+)$`, "i"),
  );
  if (!match) return null;

  const houseNumber = normalizeHouseNumber(match[1]);
  const streetQuery = normalizeStreetQuery(match[2]);

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
  const cleaned = preprocessAddressInput(rawAddress);
  if (!cleaned) return null;

  const zipMatch = cleaned.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : null;

  const withoutCityState = cleaned
    .replace(
      /,?\s*(new york|nyc|brooklyn|queens|bronx|manhattan|staten island)\b.*$/i,
      "",
    )
    .replace(/,?\s*ny\s*\d{5}(-\d{4})?$/i, "")
    .replace(/\s+\d{5}(-\d{4})?$/i, "")
    .trim();

  // House number only (user still typing the street)
  const houseOnly = withoutCityState.match(
    new RegExp(`^(${HOUSE_NUMBER_PATTERN})$`, "i"),
  );
  if (houseOnly) {
    return {
      houseNumber: normalizeHouseNumber(houseOnly[1]),
      streetQuery: null,
      zip,
    };
  }

  const match = withoutCityState.match(
    new RegExp(`^(${HOUSE_NUMBER_PATTERN})\\s+(.+)$`, "i"),
  );
  if (!match) return null;

  const houseNumber = normalizeHouseNumber(match[1]);
  const streetQuery = normalizeStreetQuery(match[2]);

  if (!houseNumber) return null;
  return { houseNumber, streetQuery: streetQuery || null, zip };
}

/** Outcomes for classifySuggestInput / classifyAddressInput before any API call. */
export type AddressQueryClassification =
  | { status: "idle" }
  | { status: "insufficient" }
  | { status: "invalid" }
  | {
      status: "ok";
      houseNumber: string;
      streetQuery: string;
      zip: string | null;
    };

/**
 * Decide whether a typed suggest query is ready to hit Open Data.
 * - idle: fewer than MIN_QUERY_LENGTH characters
 * - insufficient: house only, or street fragment shorter than MIN_STREET_QUERY_LENGTH
 * - invalid: jumbled / non-address text that does not parse
 * - ok: house + usable street fragment (optional ZIP)
 */
export function classifySuggestInput(
  rawAddress: string,
): AddressQueryClassification {
  const trimmed = rawAddress.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { status: "idle" };
  }

  const parsed = parseSuggestQuery(rawAddress);
  if (!parsed) {
    return { status: "invalid" };
  }

  if (
    !parsed.streetQuery ||
    parsed.streetQuery.length < MIN_STREET_QUERY_LENGTH
  ) {
    return { status: "insufficient" };
  }

  return {
    status: "ok",
    houseNumber: parsed.houseNumber,
    streetQuery: parsed.streetQuery,
    zip: parsed.zip,
  };
}

/**
 * Stricter free-text address classification for the violations-by-address path.
 */
export function classifyAddressInput(
  rawAddress: string,
): AddressQueryClassification {
  const trimmed = rawAddress.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { status: "insufficient" };
  }

  const parsed = parseNycAddress(rawAddress);
  if (parsed) {
    if (parsed.streetQuery.length < MIN_STREET_QUERY_LENGTH) {
      return { status: "insufficient" };
    }
    return {
      status: "ok",
      houseNumber: parsed.houseNumber,
      streetQuery: parsed.streetQuery,
      zip: parsed.zip,
    };
  }

  // House-only (or near house-only) is "too little", not "invalid"
  const loose = parseSuggestQuery(rawAddress);
  if (
    loose &&
    (!loose.streetQuery || loose.streetQuery.length < MIN_STREET_QUERY_LENGTH)
  ) {
    return { status: "insufficient" };
  }

  return { status: "invalid" };
}
