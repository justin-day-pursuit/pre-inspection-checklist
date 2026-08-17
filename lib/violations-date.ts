/**
 * Local-safe calendar-day helpers for HPD approvedDate values.
 * Avoids `new Date("YYYY-MM-DD")` UTC midnight shifting the visible day.
 */

type LocalDateParts = { year: number; month: number; day: number };

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

function parseLocalDateParts(value: string): LocalDateParts | null {
  const match = DATE_PREFIX.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    return { year, month, day };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

/** Normalize to YYYY-MM-DD for filter values and matching. Empty stays empty. */
export function toDayKey(value: string): string {
  if (!value) return "";
  const parts = parseLocalDateParts(value);
  if (!parts) return value;
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** Readable label without UTC day-shift for date-only strings. */
export function formatViolationDate(value: string): string {
  if (!value) return "—";
  const parts = parseLocalDateParts(value);
  if (!parts) return value;
  const local = new Date(parts.year, parts.month - 1, parts.day);
  return local.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
