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

  it("captures optional ZIP on ok suggest queries", () => {
    const result = classifySuggestInput("7011 18 Ave 11204");
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.equal(result.zip, "11204");
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
});
