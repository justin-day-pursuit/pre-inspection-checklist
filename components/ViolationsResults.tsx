"use client";

/**
 * ViolationsResults
 * -----------------
 * Own scrollable list container for open HPD violations.
 * Grows with content up to a max height, then scrolls on its own.
 *
 * Columns (UI label ← dataset field):
 * - Vio #      ← violationid
 * - Vio code   ← ordernumber
 * - Class      ← class
 * - Descript   ← novdescription
 * - Apt        ← apartment (may be empty)
 * - Date       ← novissueddate
 */

import { useEffect, useMemo, useState } from "react";
import type { HpdViolation } from "@/lib/violations-types";

type ViolationsResultsProps = {
  violations: HpdViolation[];
  searchedAddress: string;
};

type ColumnFilterKey =
  | "violationId"
  | "orderNumber"
  | "violationClass"
  | "description"
  | "apartment"
  | "novIssuedDate";

type ColumnFilters = Record<ColumnFilterKey, string>;

/** Sentinel so empty Apt can be filtered without colliding with "All" (value=""). */
const BLANK_VALUE = "__blank__";

const EMPTY_FILTERS: ColumnFilters = {
  violationId: "",
  orderNumber: "",
  violationClass: "",
  description: "",
  apartment: "",
  novIssuedDate: "",
};

const FILTER_COLUMNS: {
  key: ColumnFilterKey;
  label: string;
  thClassName: string;
}[] = [
  {
    key: "violationId",
    label: "Vio #",
    thClassName: "whitespace-nowrap px-3 py-2 font-medium",
  },
  {
    key: "orderNumber",
    label: "Vio code",
    thClassName: "whitespace-nowrap px-3 py-2 font-medium",
  },
  {
    key: "violationClass",
    label: "Class",
    thClassName: "whitespace-nowrap px-3 py-2 font-medium",
  },
  {
    key: "description",
    label: "Descript",
    thClassName: "min-w-[14rem] px-3 py-2 font-medium",
  },
  {
    key: "apartment",
    label: "Apt",
    thClassName: "whitespace-nowrap px-3 py-2 font-medium",
  },
  {
    key: "novIssuedDate",
    label: "Date",
    thClassName: "whitespace-nowrap px-3 py-2 font-medium",
  },
];

export default function ViolationsResults({
  violations,
  searchedAddress,
}: ViolationsResultsProps) {
  const [filters, setFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterOptions = useMemo(() => {
    return {
      violationId: uniqueSorted(violations.map((row) => row.violationId)),
      orderNumber: uniqueSorted(violations.map((row) => row.orderNumber)),
      violationClass: uniqueSorted(
        violations.map((row) => row.violationClass),
      ),
      description: uniqueSorted(violations.map((row) => row.description)),
      apartment: uniqueSorted(violations.map((row) => row.apartment)),
      novIssuedDate: uniqueSorted(violations.map((row) => row.novIssuedDate)),
    } satisfies Record<ColumnFilterKey, string[]>;
  }, [violations]);

  const filtered = useMemo(() => {
    return violations.filter((row) => {
      return (
        matchesFilter(filters.violationId, row.violationId) &&
        matchesFilter(filters.orderNumber, row.orderNumber) &&
        matchesFilter(filters.violationClass, row.violationClass) &&
        matchesFilter(filters.description, row.description) &&
        matchesFilter(filters.apartment, row.apartment) &&
        matchesFilter(filters.novIssuedDate, row.novIssuedDate)
      );
    });
  }, [filters, violations]);

  // Clear selection when the highlighted row is no longer visible
  useEffect(() => {
    if (
      selectedId !== null &&
      !filtered.some((row) => row.violationId === selectedId)
    ) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  function toggleSelected(violationId: string) {
    setSelectedId((current) =>
      current === violationId ? null : violationId,
    );
  }

  function setColumnFilter(key: ColumnFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section
      className="mt-8 w-full"
      aria-label="Open HPD violations results"
    >
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

      {/*
        Dedicated list container:
        - width follows the page (dynamic horizontal sizing)
        - height grows with rows up to max-h, then scrolls independently
      */}
      <div
        className="mt-4 max-h-[min(60vh,28rem)] w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-sm"
        role="region"
        aria-label="Scrollable violations list"
      >
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-100 text-zinc-700">
            <tr>
              {FILTER_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.thClassName}
                >
                  {column.label}
                </th>
              ))}
            </tr>
            <tr className="border-t border-zinc-200 bg-zinc-100">
              {FILTER_COLUMNS.map((column) => (
                <th
                  key={`${column.key}-filter`}
                  scope="col"
                  className="px-2 py-1.5 font-normal"
                >
                  <label className="block">
                    <span className="sr-only">Filter by {column.label}</span>
                    <select
                      value={filters[column.key]}
                      onChange={(event) =>
                        setColumnFilter(column.key, event.target.value)
                      }
                      className="min-h-8 w-full max-w-full rounded border border-zinc-300 bg-white px-1.5 text-xs text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
                    >
                      <option value="">All</option>
                      {filterOptions[column.key].map((value) => (
                        <option
                          key={optionKey(column.key, value)}
                          value={toOptionValue(value)}
                        >
                          {optionLabel(column.key, value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-zinc-600">
                  No violations match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                const isSelected = selectedId === row.violationId;
                const zebraClass =
                  index % 2 === 0 ? "bg-white" : "bg-zinc-50";
                const rowClass = isSelected
                  ? "bg-zinc-200 ring-1 ring-inset ring-zinc-400"
                  : `${zebraClass} hover:bg-zinc-100`;

                return (
                  <tr
                    key={row.violationId}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => toggleSelected(row.violationId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSelected(row.violationId);
                      }
                    }}
                    className={`cursor-pointer border-t border-zinc-200 align-top ${rowClass}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                      {row.violationId || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                      {row.orderNumber || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                      {row.violationClass || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">
                      {row.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {/* Apt may be empty in the HPD data */}
                      {row.apartment || ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                      {formatDate(row.novIssuedDate)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function matchesFilter(filterValue: string, cellValue: string): boolean {
  if (!filterValue) return true;
  if (filterValue === BLANK_VALUE) return cellValue === "";
  return cellValue === filterValue;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

function toOptionValue(value: string): string {
  return value === "" ? BLANK_VALUE : value;
}

function optionKey(key: ColumnFilterKey, value: string): string {
  // Empty apt needs a stable distinct key in the options list
  return value === "" ? `${key}__blank` : `${key}__${value}`;
}

function optionLabel(key: ColumnFilterKey, value: string): string {
  if (key === "apartment" && value === "") return "(blank)";
  if (key === "novIssuedDate") return formatDate(value);
  if (key === "description") return truncateLabel(value, 60);
  return value || "—";
}

function truncateLabel(value: string, maxLength: number): string {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
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
