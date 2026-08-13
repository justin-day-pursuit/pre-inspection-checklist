import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyAddressInput,
  classifySuggestInput,
} from "./address-query";

describe("classifySuggestInput", () => {
  it("returns idle for queries shorter than MIN_QUERY_LENGTH", () => {
    assert.deepEqual(classifySuggestInput(""), { status: "idle" });
    assert.deepEqual(classifySuggestInput("7"), { status: "idle" });
    assert.deepEqual(classifySuggestInput(" "), { status: "idle" });
  });

  it("returns insufficient for house-only or short street fragments", () => {
    assert.deepEqual(classifySuggestInput("7011"), {
      status: "insufficient",
    });
    assert.deepEqual(classifySuggestInput("7011 A"), {
      status: "insufficient",
    });
  });

  it("returns insufficient for street-type-only or street-only input", () => {
    assert.deepEqual(classifySuggestInput("18 Ave"), {
      status: "insufficient",
    });
    assert.deepEqual(classifySuggestInput("18th Ave"), {
      status: "insufficient",
    });
  });

  it("returns invalid for jumbled non-address text", () => {
    assert.deepEqual(classifySuggestInput("!!!@@@"), { status: "invalid" });
    assert.deepEqual(classifySuggestInput("hello world"), {
      status: "invalid",
    });
  });

  it("returns ok for house + usable street fragment", () => {
    const result = classifySuggestInput("7011 18th Ave");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.houseNumber, "7011");
      assert.equal(result.streetQuery, "18 AVENUE");
      assert.equal(result.zip, null);
    }
  });

  it("preserves saint names and expands trailing ST to STREET", () => {
    const nicholas = classifySuggestInput("7011 St Nicholas Ave");
    assert.equal(nicholas.status, "ok");
    if (nicholas.status === "ok") {
      assert.equal(nicholas.streetQuery, "ST NICHOLAS AVENUE");
    }

    const marks = classifySuggestInput("7011 St Marks Pl");
    assert.equal(marks.status, "ok");
    if (marks.status === "ok") {
      assert.equal(marks.streetQuery, "ST MARKS PLACE");
    }

    const tenth = classifySuggestInput("7011 E 10 St");
    assert.equal(tenth.status, "ok");
    if (tenth.status === "ok") {
      assert.equal(tenth.streetQuery, "E 10 STREET");
    }
  });

  it("does not strip borough names inside the street line", () => {
    const queens = classifySuggestInput("52-15 Queens Blvd");
    assert.equal(queens.status, "ok");
    if (queens.status === "ok") {
      assert.equal(queens.houseNumber, "52-15");
      assert.equal(queens.streetQuery, "QUEENS BOULEVARD");
    }

    const manhattan = classifySuggestInput("100 Manhattan Ave");
    assert.equal(manhattan.status, "ok");
    if (manhattan.status === "ok") {
      assert.equal(manhattan.houseNumber, "100");
      assert.equal(manhattan.streetQuery, "MANHATTAN AVENUE");
    }
  });

  it("normalizes Queens-style spaced hyphens in house numbers", () => {
    const result = classifySuggestInput("35 - 01 35 Ave");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.houseNumber, "35-01");
      assert.equal(result.streetQuery, "35 AVENUE");
    }
  });

  it("captures optional ZIP on ok suggest queries", () => {
    const result = classifySuggestInput("7011 18 Ave 11204");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.zip, "11204");
    }
  });

  it("strips trailing borough without a comma when street type is present", () => {
    const withZip = classifySuggestInput("7011 18 Ave Brooklyn 11204");
    assert.equal(withZip.status, "ok");
    if (withZip.status === "ok") {
      assert.equal(withZip.houseNumber, "7011");
      assert.equal(withZip.streetQuery, "18 AVENUE");
      assert.equal(withZip.zip, "11204");
    }

    const withoutZip = classifySuggestInput("7011 18 Ave Brooklyn");
    assert.equal(withoutZip.status, "ok");
    if (withoutZip.status === "ok") {
      assert.equal(withoutZip.houseNumber, "7011");
      assert.equal(withoutZip.streetQuery, "18 AVENUE");
      assert.equal(withoutZip.zip, null);
    }
  });
});

describe("classifyAddressInput", () => {
  it("returns insufficient for short or house-only input", () => {
    assert.deepEqual(classifyAddressInput(""), { status: "insufficient" });
    assert.deepEqual(classifyAddressInput("7"), { status: "insufficient" });
    assert.deepEqual(classifyAddressInput("7011"), {
      status: "insufficient",
    });
  });

  it("returns insufficient for street-type-only or street-only input", () => {
    assert.deepEqual(classifyAddressInput("18 Ave"), {
      status: "insufficient",
    });
    assert.deepEqual(classifyAddressInput("18th Ave"), {
      status: "insufficient",
    });
  });

  it("returns invalid for jumbled non-address text", () => {
    assert.deepEqual(classifyAddressInput("!!!@@@"), { status: "invalid" });
    assert.deepEqual(classifyAddressInput("not an address"), {
      status: "invalid",
    });
  });

  it("returns ok for a full parseable address", () => {
    const result = classifyAddressInput("7011 18th Ave, Brooklyn, NY 11204");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.houseNumber, "7011");
      assert.equal(result.streetQuery, "18 AVENUE");
      assert.equal(result.zip, "11204");
    }
  });

  it("preserves saint names and expands trailing ST to STREET", () => {
    const nicholas = classifyAddressInput("7011 St Nicholas Ave");
    assert.equal(nicholas.status, "ok");
    if (nicholas.status === "ok") {
      assert.equal(nicholas.streetQuery, "ST NICHOLAS AVENUE");
    }

    const tenth = classifyAddressInput("7011 E 10 St");
    assert.equal(tenth.status, "ok");
    if (tenth.status === "ok") {
      assert.equal(tenth.streetQuery, "E 10 STREET");
    }
  });

  it("does not strip borough names inside the street line", () => {
    const queens = classifyAddressInput("52-15 Queens Blvd");
    assert.equal(queens.status, "ok");
    if (queens.status === "ok") {
      assert.equal(queens.streetQuery, "QUEENS BOULEVARD");
    }

    const manhattan = classifyAddressInput("100 Manhattan Ave");
    assert.equal(manhattan.status, "ok");
    if (manhattan.status === "ok") {
      assert.equal(manhattan.streetQuery, "MANHATTAN AVENUE");
    }
  });

  it("strips trailing borough without a comma when street type is present", () => {
    const withZip = classifyAddressInput("7011 18 Ave Brooklyn 11204");
    assert.equal(withZip.status, "ok");
    if (withZip.status === "ok") {
      assert.equal(withZip.houseNumber, "7011");
      assert.equal(withZip.streetQuery, "18 AVENUE");
      assert.equal(withZip.zip, "11204");
    }

    const withoutZip = classifyAddressInput("7011 18 Ave Brooklyn");
    assert.equal(withoutZip.status, "ok");
    if (withoutZip.status === "ok") {
      assert.equal(withoutZip.houseNumber, "7011");
      assert.equal(withoutZip.streetQuery, "18 AVENUE");
      assert.equal(withoutZip.zip, null);
    }
  });
});
