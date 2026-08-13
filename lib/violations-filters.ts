/**
 * Client-safe violations table filter helpers
 * -------------------------------------------
 * Pure functions used by ViolationsResults and covered by node:test.
 */

/** Sentinel so empty Apt can be filtered without colliding with "All" (value=""). */
export const BLANK_VALUE = "__blank__";

/** Exact-match column filter (dropdowns). Empty filter means All. */
export function matchesFilter(
  filterValue: string,
  cellValue: string,
): boolean {
  if (!filterValue) return true;
  if (filterValue === BLANK_VALUE) return cellValue === "";
  return cellValue === filterValue;
}

/** Case-insensitive substring match for the Descript text filter. */
export function matchesDescriptFilter(
  filterValue: string,
  cellValue: string,
): boolean {
  const needle = filterValue.trim().toLowerCase();
  if (!needle) return true;
  return cellValue.toLowerCase().includes(needle);
}

/** True when any column filter (dropdown or Descript text) is active. */
export function hasActiveFilters(filters: Record<string, string>): boolean {
  return Object.values(filters).some((value) => value.trim() !== "");
}
