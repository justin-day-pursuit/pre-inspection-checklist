/**
 * Shared violation types
 * ----------------------
 * Kept in a separate file so browser components can import types
 * without pulling server-only NYC Open Data code into the client bundle.
 */

/** One unique open violation we show in the results table. */
export type HpdViolation = {
  violationId: string;
  orderNumber: string;
  description: string;
  /** Mapped from HPD `approveddate` (closest stable "created" date). */
  originalCreationDate: string;
  houseNumber: string;
  streetName: string;
  borough: string;
  zip: string;
};

/** Typed outcomes the UI / API can switch on. */
export type ViolationsSearchResult =
  | { status: "ok"; violations: HpdViolation[] }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "timeout" };
