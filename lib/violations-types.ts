/**
 * Shared violation types
 * ----------------------
 * Kept in a separate file so browser components can import types
 * without pulling server-only NYC Open Data code into the client bundle.
 */

/** One unique open violation we show in the results list. */
export type HpdViolation = {
  /** Violation # → UI label "Vio #" */
  violationId: string;
  /** Order number → UI label "Vio code" */
  orderNumber: string;
  /** Class (A / B / C seriousness) */
  violationClass: string;
  /** NOV Description → UI label "Descript" */
  description: string;
  /** Apartment — may be empty */
  apartment: string;
  /** NOV Issued Date → UI label "Date" */
  novIssuedDate: string;
  houseNumber: string;
  streetName: string;
  borough: string;
  zip: string;
};

/** Typed outcomes the UI / API can switch on. */
export type ViolationsSearchResult =
  | { status: "ok"; violations: HpdViolation[] }
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "insufficient" }
  | { status: "error"; message: string }
  | { status: "timeout" };

/** One unique building address shown in the match list while typing. */
export type AddressMatch = {
  /** Stable key for React lists + selection */
  id: string;
  houseNumber: string;
  streetName: string;
  borough: string;
  zip: string;
  /** Human-readable line shown in the dropdown */
  label: string;
};

/** Outcomes for the address "check" / suggest call. */
export type AddressSuggestResult =
  | { status: "ok"; matches: AddressMatch[] }
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "insufficient" }
  | { status: "error"; message: string }
  | { status: "timeout" };
