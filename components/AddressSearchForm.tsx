"use client";

/**
 * AddressSearchForm
 * -----------------
 * Simple US address search box (project focus: NYC).
 *
 * IMPORTANT for maintainers:
 * This form intentionally does NOT send data anywhere.
 * Pressing Enter or clicking Search only shows a local "coming soon" note.
 * Do not wire Gemini or an address API here until that feature is ready.
 */

import { FormEvent, useState } from "react";

export default function AddressSearchForm() {
  // What the user typed into the search box
  const [address, setAddress] = useState("");
  // Local-only message — not sent to a server
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * Runs when the user presses Enter or clicks Search.
   * preventDefault() stops the browser from submitting/reloading the page.
   */
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // UI-only feedback — no fetch, no Server Action, no navigation
    setNotice(
      "Address search is not connected yet. Your text stayed on this page and was not sent.",
    );
  }

  return (
    <form
      onSubmit={handleSearch}
      className="mt-8 w-full max-w-xl"
      // noValidate keeps the browser from blocking with HTML5 validation popups
      noValidate
    >
      <label
        htmlFor="address-search"
        className="block text-sm font-medium text-zinc-700"
      >
        Search a United States address
      </label>
      <p className="mt-1 text-sm text-zinc-500">
        This project focuses on New York City (NYC) properties.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          id="address-search"
          name="address"
          type="text"
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            // Clear the notice when the user starts typing again
            if (notice) setNotice(null);
          }}
          placeholder="e.g. 350 5th Ave, New York, NY 10118"
          autoComplete="street-address"
          className="min-h-11 w-full flex-1 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2"
        />

        <button
          type="submit"
          className="min-h-11 rounded-md bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Search
        </button>
      </div>

      {notice ? (
        <p className="mt-3 text-sm text-zinc-600" role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
