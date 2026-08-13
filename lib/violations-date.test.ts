import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatViolationDate, toDayKey } from "./violations-date";

describe("toDayKey", () => {
  it("returns empty for blank input", () => {
    assert.equal(toDayKey(""), "");
  });

  it("keeps YYYY-MM-DD as the day key", () => {
    assert.equal(toDayKey("2024-01-15"), "2024-01-15");
  });

  it("collapses same calendar day from datetime prefixes", () => {
    assert.equal(toDayKey("2024-01-15T00:00:00"), "2024-01-15");
    assert.equal(toDayKey("2024-01-15T12:30:00.000"), "2024-01-15");
  });

  it("returns unparseable values unchanged", () => {
    assert.equal(toDayKey("not-a-date"), "not-a-date");
  });
});

describe("formatViolationDate", () => {
  it("returns dash for blank", () => {
    assert.equal(formatViolationDate(""), "—");
  });

  it("formats date-only without UTC day-shift", () => {
    // `new Date("YYYY-MM-DD")` is UTC midnight and can show the prior day in US zones.
    assert.equal(formatViolationDate("2024-01-15"), "Jan 15, 2024");
  });

  it("returns unparseable values unchanged", () => {
    assert.equal(formatViolationDate("not-a-date"), "not-a-date");
  });
});
