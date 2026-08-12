"use client";

/**
 * AddressSearchForm
 * -----------------
 * Flow:
 * 1. User types an address → debounced "check" call lists matching buildings
 * 2. Under the bar: loading, match list, or "No match found"
 * 3. User clicks a listed address → fetch open violations for that building
 * 4. After that click, the match list stays hidden until the user focuses
 *    the search bar again (or types a new query).
 *
 * Violation fetch still uses a 30s timeout with error/timeout messages + logs.
 */

import { FormEvent, useEffect, useRef, useState } from "react";
import type { AddressMatch, HpdViolation } from "@/lib/violations-types";
import ViolationsResults from "@/components/ViolationsResults";

/** Wait this long after typing before calling the address-check API. */
const SUGGEST_DEBOUNCE_MS = 350;

/** Shared 30-second client timeout for check + violations calls. */
const CLIENT_TIMEOUT_MS = 30_000;

/** Need at least this many characters before we ask Open Data for matches. */
const MIN_QUERY_LENGTH = 2;

type SuggestStatus = "idle" | "loading" | "ok" | "empty" | "error" | "timeout";
type ViolationsStatus = "idle" | "loading" | "ok" | "empty" | "error" | "timeout";

type SuggestApiResponse = {
  status?: string;
  matches?: AddressMatch[];
  message?: string;
};

type ViolationsApiResponse = {
  status?: string;
  violations?: HpdViolation[];
  message?: string;
};

export default function AddressSearchForm() {
  const [address, setAddress] = useState("");
  const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>("idle");
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [violationsStatus, setViolationsStatus] =
    useState<ViolationsStatus>("idle");
  const [violations, setViolations] = useState<HpdViolation[]>([]);
  const [lastSearchedAddress, setLastSearchedAddress] = useState("");
  // After the user picks an address (violations API starts), hide the match list
  // until they click/focus back into the search bar.
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(true);

  // Used to scroll the form to the top after violations load finishes
  const formSectionRef = useRef<HTMLElement | null>(null);
  // Ignore stale suggest responses when the user keeps typing
  const suggestRequestId = useRef(0);

  /**
   * Debounced address-check while typing.
   * Shows loading → list, or "No match found".
   */
  useEffect(() => {
    const trimmed = address.trim();

    // Reset suggestions when the box is too short / cleared
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestStatus("idle");
      setMatches([]);
      return;
    }

    // Hide / skip the match list after a selection until the user re-enters the bar
    if (!suggestionsEnabled) {
      return;
    }

    // Do not refresh the match list while violations are loading
    if (violationsStatus === "loading") {
      return;
    }

    const controller = new AbortController();
    const requestId = ++suggestRequestId.current;
    const timer = window.setTimeout(async () => {
      setSuggestStatus("loading");

      const timeoutId = window.setTimeout(
        () => controller.abort(),
        CLIENT_TIMEOUT_MS,
      );

      try {
        const response = await fetch("/api/addresses/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
          signal: controller.signal,
        });

        let payload: SuggestApiResponse = {};
        try {
          payload = (await response.json()) as SuggestApiResponse;
        } catch {
          payload = {};
        }

        // Skip if a newer keystroke already started another check
        if (requestId !== suggestRequestId.current) return;

        if (
          payload.status === "timeout" ||
          response.status === 408 ||
          response.status === 504
        ) {
          console.error("[address-suggest] timeout", {
            query: trimmed,
            message: payload.message || "The search timed out",
          });
          setMatches([]);
          setSuggestStatus("timeout");
          return;
        }

        if (payload.status === "ok" && Array.isArray(payload.matches)) {
          setMatches(payload.matches);
          setSuggestStatus(payload.matches.length > 0 ? "ok" : "empty");
          return;
        }

        if (payload.status === "empty") {
          setMatches([]);
          setSuggestStatus("empty");
          return;
        }

        console.error("[address-suggest] error", {
          query: trimmed,
          message: payload.message || "Error in getting data",
          httpStatus: response.status,
        });
        setMatches([]);
        setSuggestStatus("error");
      } catch (error) {
        if (requestId !== suggestRequestId.current) return;

        if (error instanceof Error && error.name === "AbortError") {
          console.error("[address-suggest] timeout", {
            query: trimmed,
            message: "Client abort after 30s",
          });
          setMatches([]);
          setSuggestStatus("timeout");
          return;
        }

        console.error("[address-suggest] error", {
          query: trimmed,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        setMatches([]);
        setSuggestStatus("error");
      } finally {
        window.clearTimeout(timeoutId);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, violationsStatus, suggestionsEnabled]);

  /**
   * User clicked one listed building → fetch its open violations.
   * Disable the match list until they focus the search bar again.
   */
  async function handleSelectMatch(match: AddressMatch) {
    setAddress(match.label);
    setMatches([]);
    setSuggestStatus("idle");
    setSuggestionsEnabled(false);
    setViolations([]);
    setViolationsStatus("loading");
    setLastSearchedAddress(match.label);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseNumber: match.houseNumber,
          streetName: match.streetName,
          zip: match.zip,
        }),
        signal: controller.signal,
      });

      let payload: ViolationsApiResponse = {};
      try {
        payload = (await response.json()) as ViolationsApiResponse;
      } catch {
        payload = {};
      }

      if (
        payload.status === "timeout" ||
        response.status === 408 ||
        response.status === 504
      ) {
        console.error("[violations-search] timeout", {
          address: match.label,
          message: payload.message || "The search timed out",
        });
        setViolationsStatus("timeout");
      } else if (payload.status === "empty") {
        setViolationsStatus("empty");
      } else if (payload.status === "ok" && Array.isArray(payload.violations)) {
        if (payload.violations.length === 0) {
          setViolationsStatus("empty");
        } else {
          setViolations(payload.violations);
          setViolationsStatus("ok");
        }
      } else {
        console.error("[violations-search] error", {
          address: match.label,
          message: payload.message || "Error in getting data",
          httpStatus: response.status,
        });
        setViolationsStatus("error");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error("[violations-search] timeout", {
          address: match.label,
          message: "Client abort after 30s",
        });
        setViolationsStatus("timeout");
      } else {
        console.error("[violations-search] error", {
          address: match.label,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        setViolationsStatus("error");
      }
    } finally {
      window.clearTimeout(timer);
      requestAnimationFrame(() => {
        formSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  /**
   * Enter / Search re-runs the address-check for the current text.
   * Violations only load after clicking a listed match.
   */
  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Force a fresh suggest by tweaking status; effect already depends on address.
    // If the user presses Enter with matches showing, keep the list visible.
    const trimmed = address.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestStatus("empty");
      setMatches([]);
      return;
    }
    // Clear prior violation results when re-checking addresses
    setViolations([]);
    setViolationsStatus("idle");
    // Nudge suggest status so the user sees loading immediately
    setSuggestStatus("loading");
    // Re-trigger effect by bumping request id via a no-op address normalize
    setAddress(`${trimmed}`);
  }

  const showSuggestPanel =
    suggestionsEnabled &&
    address.trim().length >= MIN_QUERY_LENGTH &&
    violationsStatus !== "loading" &&
    suggestStatus !== "idle";

  return (
    <section ref={formSectionRef} className="mt-8 w-full scroll-mt-6">
      <form onSubmit={handleSearchSubmit} className="w-full max-w-xl" noValidate>
        <label
          htmlFor="address-search"
          className="block text-sm font-medium text-zinc-700"
        >
          Search a United States address
        </label>
        <p className="mt-1 text-sm text-zinc-500">
          Start typing an NYC address, pick a match from the list, then view
          open HPD violations for that building.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="address-search"
            name="address"
            type="text"
            value={address}
            onFocus={() => {
              // Re-entering the search bar unlocks the address match list again
              setSuggestionsEnabled(true);
            }}
            onChange={(event) => {
              setAddress(event.target.value);
              setSuggestionsEnabled(true);
              // Clear old violation results when the user edits the query
              if (violationsStatus !== "idle") {
                setViolations([]);
                setViolationsStatus("idle");
              }
            }}
            placeholder="e.g. 7011 18th Ave, Brooklyn, NY 11204"
            autoComplete="off"
            disabled={violationsStatus === "loading"}
            className="min-h-11 w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 disabled:bg-zinc-100"
          />

          <button
            type="submit"
            disabled={violationsStatus === "loading"}
            className="min-h-11 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            Search
          </button>
        </div>
      </form>

      {/* Address-check panel: loading, matches, or no match */}
      {showSuggestPanel ? (
        <div className="mt-3 w-full max-w-xl" aria-live="polite">
          {suggestStatus === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-zinc-600">
              <span
                className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800"
                aria-hidden="true"
              />
              Waiting for data
            </div>
          ) : null}

          {suggestStatus === "ok" ? (
            <ul
              className="overflow-hidden rounded-md border border-zinc-200 bg-white"
              role="listbox"
              aria-label="Matching addresses"
            >
              {matches.map((match) => (
                <li key={match.id} role="option">
                  <button
                    type="button"
                    className="w-full border-b border-zinc-100 px-3 py-2.5 text-left text-sm text-zinc-800 last:border-b-0 hover:bg-zinc-50"
                    onClick={() => handleSelectMatch(match)}
                  >
                    {match.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {suggestStatus === "empty" ? (
            <p className="text-sm text-zinc-700" role="status">
              No match found
            </p>
          ) : null}

          {suggestStatus === "error" ? (
            <p className="text-sm text-red-700" role="alert">
              Error in getting data
            </p>
          ) : null}

          {suggestStatus === "timeout" ? (
            <p className="text-sm text-amber-800" role="alert">
              The search timed out
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Violations fetch spinner (after clicking a listed address) */}
      {violationsStatus === "loading" ? (
        <div
          className="mt-6 flex items-center gap-3 text-sm text-zinc-600"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800"
            aria-hidden="true"
          />
          Waiting for data
        </div>
      ) : null}

      {violationsStatus === "empty" ? (
        <p className="mt-6 text-sm text-zinc-700" role="status">
          No match found
        </p>
      ) : null}

      {violationsStatus === "error" ? (
        <p className="mt-6 text-sm text-red-700" role="alert">
          Error in getting data
        </p>
      ) : null}

      {violationsStatus === "timeout" ? (
        <p className="mt-6 text-sm text-amber-800" role="alert">
          The search timed out
        </p>
      ) : null}

      {violationsStatus === "ok" ? (
        <ViolationsResults
          violations={violations}
          searchedAddress={lastSearchedAddress}
        />
      ) : null}
    </section>
  );
}
