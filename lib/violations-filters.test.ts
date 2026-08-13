import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BLANK_VALUE,
  hasActiveFilters,
  matchesDescriptFilter,
  matchesFilter,
} from "./violations-filters";

describe("matchesFilter", () => {
  it("treats empty filter as All", () => {
    assert.equal(matchesFilter("", "A"), true);
    assert.equal(matchesFilter("", ""), true);
  });

  it("matches BLANK_VALUE only to empty cells", () => {
    assert.equal(matchesFilter(BLANK_VALUE, ""), true);
    assert.equal(matchesFilter(BLANK_VALUE, "2A"), false);
  });

  it("exact-matches non-blank filter values", () => {
    assert.equal(matchesFilter("C", "C"), true);
    assert.equal(matchesFilter("C", "B"), false);
  });
});

describe("matchesDescriptFilter", () => {
  it("treats blank/whitespace filter as All", () => {
    assert.equal(matchesDescriptFilter("", "PAINT"), true);
    assert.equal(matchesDescriptFilter("   ", "PAINT"), true);
  });

  it("case-insensitive substring matches description", () => {
    assert.equal(
      matchesDescriptFilter("paint", "SECTION 27: PAINT REQUIRED"),
      true,
    );
    assert.equal(matchesDescriptFilter("HEAT", "no heat in apt"), true);
    assert.equal(matchesDescriptFilter("mold", "PAINT REQUIRED"), false);
  });
});

describe("hasActiveFilters", () => {
  it("is false when every filter is empty/whitespace", () => {
    assert.equal(
      hasActiveFilters({ a: "", b: "  ", description: "" }),
      false,
    );
  });

  it("is true when any dropdown or Descript text is set", () => {
    assert.equal(hasActiveFilters({ a: "", b: "C" }), true);
    assert.equal(hasActiveFilters({ description: "paint" }), true);
    assert.equal(hasActiveFilters({ apartment: BLANK_VALUE }), true);
  });
});

describe("AND filter behavior (dropdown + Descript)", () => {
  it("requires both exact column match and descript substring", () => {
    const row = {
      violationClass: "C",
      description: "SECTION 27: PAINT REQUIRED",
      apartment: "",
    };

    const classOk = matchesFilter("C", row.violationClass);
    const descriptOk = matchesDescriptFilter("paint", row.description);
    const aptBlank = matchesFilter(BLANK_VALUE, row.apartment);
    assert.equal(classOk && descriptOk && aptBlank, true);

    const classMismatch = matchesFilter("B", row.violationClass);
    assert.equal(classMismatch && descriptOk, false);

    const descriptMismatch = matchesDescriptFilter("heat", row.description);
    assert.equal(classOk && descriptMismatch, false);
  });
});
