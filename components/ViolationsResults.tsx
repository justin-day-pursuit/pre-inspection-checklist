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
 * - Created    ← approveddate (original creation)
 */

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { HpdViolation } from "@/lib/violations-types";
import {
  BLANK_VALUE,
  hasActiveFilters,
  matchesDescriptFilter,
  matchesFilter,
} from "@/lib/violations-filters";
import { formatViolationDate, toDayKey } from "@/lib/violations-date";

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
  | "approvedDate";

type ColumnFilters = Record<ColumnFilterKey, string>;

const EMPTY_FILTERS: ColumnFilters = {
  violationId: "",
  orderNumber: "",
  violationClass: "",
  description: "",
  apartment: "",
  approvedDate: "",
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
    key: "approvedDate",
    label: "Created",
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
      apartment: uniqueSorted(violations.map((row) => row.apartment)),
      // Dedupe by calendar day so raw timestamp variants collapse
      approvedDate: uniqueSorted(
        violations.map((row) => toDayKey(row.approvedDate)),
      ),
    } satisfies Record<Exclude<ColumnFilterKey, "description">, string[]>;
  }, [violations]);

  const filtered = useMemo(() => {
    return violations.filter((row) => {
      return (
        matchesFilter(filters.violationId, row.violationId) &&
        matchesFilter(filters.orderNumber, row.orderNumber) &&
        matchesFilter(filters.violationClass, row.violationClass) &&
        matchesDescriptFilter(filters.description, row.description) &&
        matchesFilter(filters.apartment, row.apartment) &&
        matchesFilter(filters.approvedDate, toDayKey(row.approvedDate))
      );
    });
  }, [filters, violations]);

  const filtersActive = hasActiveFilters(filters);

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

  function onRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    violationId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSelected(violationId);
    }
  }

  function setColumnFilter(key: ColumnFilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const totalCount = violations.length;
  const shownCount = filtered.length;
  const countNoun = totalCount === 1 ? "violation" : "violations";

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
          {filtersActive ? (
            <>
              Showing {shownCount} of {totalCount} unique {countNoun} for{" "}
            </>
          ) : (
            <>
              {totalCount} unique {countNoun} found for{" "}
            </>
          )}
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
                    {column.key === "description" ? (
                      <input
                        type="search"
                        value={filters.description}
                        onChange={(event) =>
                          setColumnFilter("description", event.target.value)
                        }
                        placeholder="Search…"
                        className="min-h-8 w-full max-w-full rounded border border-zinc-300 bg-white px-1.5 text-xs text-zinc-800 outline-none ring-zinc-400 placeholder:text-zinc-400 focus:ring-2"
                      />
                    ) : (
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
                    )}
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
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => toggleSelected(row.violationId)}
                    onKeyDown={(event) =>
                      onRowKeyDown(event, row.violationId)
                    }
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
                      {formatViolationDate(row.approvedDate)}
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
  if (key === "approvedDate") return formatViolationDate(value);
  return value || "—";
}
