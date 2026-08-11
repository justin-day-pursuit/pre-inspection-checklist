"use client";

/**
 * AddressSearchForm
 * -----------------
 * Landing-page search box for NYC addresses.
 * On Enter or Search click, calls our server route `/api/violations`,
 * which queries NYC Open Data (Open HPD Violations) via SODA3.
 *
 * While waiting: shows a spinner under the form.
 * When finished: scrolls so this form sits at the top of the page,
 * then shows either results, "No match found", an error, or a timeout message.
 */

import { FormEvent, useRef, useState } from "react";
import type { HpdViolation } from "@/lib/violations-types";
import ViolationsResults from "@/components/ViolationsResults";

/** Shared 30-second client timeout (matches the server NYC fetch timeout). */
const CLIENT_TIMEOUT_MS = 30_000;

type SearchStatus = "idle" | "loading" | "ok" | "empty" | "error" | "timeout";

type ApiResponse = {
  status?: string;
  violations?: HpdViolation[];
  message?: string;
};

export default function AddressSearchForm() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [violations, setViolations] = useState<HpdViolation[]>([]);
  const [lastSearchedAddress, setLastSearchedAddress] = useState("");

  // Used to scroll the form to the top of the viewport after the API call ends
  const formSectionRef = useRef<HTMLElement | null>(null);

  /**
   * Runs when the user presses Enter or clicks Search.
   * preventDefault stops a full page reload.
   */
  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = address.trim();
    if (!trimmed) {
      setStatus("empty");
      setViolations([]);
      return;
    }

    setStatus("loading");
    setViolations([]);
    setLastSearchedAddress(trimmed);

    // Abort the browser fetch if NYC / our API takes longer than 30 seconds
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
        signal: controller.signal,
      });

      let payload: ApiResponse = {};
      try {
        payload = (await response.json()) as ApiResponse;
      } catch {
        payload = {};
      }

      // Prefer explicit status from the API; also treat Abort/timeout HTTP codes
      if (payload.status === "timeout" || response.status === 408 || response.status === 504) {
        setStatus("timeout");
      } else if (payload.status === "empty") {
        setStatus("empty");
      } else if (payload.status === "ok" && Array.isArray(payload.violations)) {
        if (payload.violations.length === 0) {
          setStatus("empty");
        } else {
          setViolations(payload.violations);
          setStatus("ok");
        }
      } else if (!response.ok || payload.status === "error") {
        setStatus("error");
      } else {
        setStatus("error");
      }
    } catch (error) {
      // Client-side AbortController → show the same timeout message
      if (error instanceof Error && error.name === "AbortError") {
        setStatus("timeout");
      } else {
        setStatus("error");
      }
    } finally {
      clearTimeout(timer);

      // After the call closes, scroll so the search form is at the top
      requestAnimationFrame(() => {
        formSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  return (
    <section ref={formSectionRef} className="mt-8 w-full scroll-mt-6">
      <form onSubmit={handleSearch} className="w-full max-w-xl" noValidate>
        <label
          htmlFor="address-search"
          className="block text-sm font-medium text-zinc-700"
        >
          Search a United States address
        </label>
        <p className="mt-1 text-sm text-zinc-500">
          Enter an NYC building address to look up open HPD violations.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <input
            id="address-search"
            name="address"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="e.g. 350 5th Ave, New York, NY 10118"
            autoComplete="street-address"
            disabled={status === "loading"}
            className="min-h-11 w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2 disabled:bg-zinc-100"
          />

          <button
            type="submit"
            disabled={status === "loading"}
            className="min-h-11 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            Search
          </button>
        </div>
      </form>

      {/* Spinner sits under the form while we wait for NYC Open Data */}
      {status === "loading" ? (
        <div
          className="mt-6 flex items-center gap-3 text-sm text-zinc-600"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800"
            aria-hidden="true"
          />
          Searching open HPD violations…
        </div>
      ) : null}

      {/* Empty / error / timeout messages (shown after the call finishes) */}
      {status === "empty" ? (
        <p className="mt-6 text-sm text-zinc-700" role="status">
          No match found
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-6 text-sm text-red-700" role="alert">
          Error in getting data
        </p>
      ) : null}

      {status === "timeout" ? (
        <p className="mt-6 text-sm text-amber-800" role="alert">
          The search timed out
        </p>
      ) : null}

      {/* Success: filterable table of unique violations */}
      {status === "ok" ? (
        <ViolationsResults
          violations={violations}
          searchedAddress={lastSearchedAddress}
        />
      ) : null}
    </section>
  );
}
