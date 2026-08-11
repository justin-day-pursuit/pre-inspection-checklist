"use client";

/**
 * ViolationsResults
 * -----------------
 * Shows open HPD violations for the searched address in a table.
 * Users can filter/search within the returned list (client-side only).
 *
 * Columns:
 * - Order Number (`ordernumber`)
 * - Description (`novdescription`)
 * - Original Creation Date (`approveddate`)
 */

import { useMemo, useState } from "react";
import type { HpdViolation } from "@/lib/violations-types";

type ViolationsResultsProps = {
  violations: HpdViolation[];
  searchedAddress: string;
};

export default function ViolationsResults({
  violations,
  searchedAddress,
}: ViolationsResultsProps) {
  // Text box that filters the already-fetched list (does not call the API again)
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return violations;

    return violations.filter((row) => {
      const haystack = [
        row.orderNumber,
        row.description,
        row.originalCreationDate,
        row.houseNumber,
        row.streetName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filterText, violations]);

  return (
    <section
      className="mt-8 w-full"
      aria-label="Open HPD violations results"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Open violations
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {violations.length} unique violation
            {violations.length === 1 ? "" : "s"} found for{" "}
            <span className="font-medium text-zinc-800">{searchedAddress}</span>
          </p>
        </div>

        {/* Filter / search within the results list */}
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">Filter violations</span>
          <input
            type="search"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Filter by order # or description"
            className="min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2"
          />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-100 text-zinc-700">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Order Number
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Description
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                Original Creation Date
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-zinc-600">
                  No violations match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.violationId}
                  className="border-t border-zinc-200 align-top"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                    {row.orderNumber || "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {row.description || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {formatDate(row.originalCreationDate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Show a readable date; fall back to the raw string or a dash. */
function formatDate(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
