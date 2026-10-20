import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatCityStateZip,
  formatInstallationAddress,
  parseCityStateZip,
  toBooksAddress,
} from "./address.ts";

test("parses city, state abbreviation, and ZIP with no commas", () => {
  assert.deepEqual(parseCityStateZip("centennial co 80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
});

test("parses the same address with commas and a full state name", () => {
  assert.deepEqual(parseCityStateZip("Centennial, CO 80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
  assert.deepEqual(parseCityStateZip("Centennial, Colorado 80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
  assert.deepEqual(parseCityStateZip("Centennial Colorado 80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
});

test("parses multi-word cities and states", () => {
  assert.deepEqual(parseCityStateZip("Colorado Springs CO 80903"), {
    city: "Colorado Springs",
    state: "CO",
    zip: "80903",
  });
  assert.deepEqual(parseCityStateZip("New York NY 10001"), {
    city: "New York",
    state: "NY",
    zip: "10001",
  });
  assert.deepEqual(parseCityStateZip("New York, New York 10001"), {
    city: "New York",
    state: "NY",
    zip: "10001",
  });
});

test("pulls city and state out of a street that was glued on with a comma", () => {
  assert.deepEqual(parseCityStateZip("7075 S Alton Way, centennial co 80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
});

test("accepts ZIP+4 and a state glued to the ZIP", () => {
  assert.deepEqual(parseCityStateZip("centennial co 80112-1234"), {
    city: "Centennial",
    state: "CO",
    zip: "80112-1234",
  });
  assert.deepEqual(parseCityStateZip("centennial co80112"), {
    city: "Centennial",
    state: "CO",
    zip: "80112",
  });
});

test("never returns the literal word null", () => {
  assert.deepEqual(parseCityStateZip("Centennial null null"), {
    city: "Centennial",
    state: "",
    zip: "",
  });
  assert.deepEqual(parseCityStateZip("null"), { city: "", state: "", zip: "" });
  assert.deepEqual(parseCityStateZip(null), { city: "", state: "", zip: "" });

  const formatted = formatInstallationAddress({
    street: "7075 S Alton Way",
    city: "Centennial",
    state: null,
    zip: undefined,
  });
  assert.equal(formatted, "7075 S Alton Way\nCentennial");
  assert.equal(formatted.toLowerCase().includes("null"), false);

  const fromParsed = formatInstallationAddress({
    street: "7075 S Alton Way",
    ...parseCityStateZip("centennial co 80112"),
  });
  assert.equal(fromParsed, "7075 S Alton Way\nCentennial, CO 80112");
  assert.equal(fromParsed.toLowerCase().includes("null"), false);
});

test("Books address payload includes state code and ZIP and omits blanks", () => {
  const parsed = parseCityStateZip("centennial co 80112");
  assert.deepEqual(toBooksAddress({ address: "7075 S Alton Way", ...parsed }), {
    address: "7075 S Alton Way",
    city: "Centennial",
    state: "CO",
    state_code: "CO",
    zip: "80112",
    country: "U.S.A",
  });
  assert.equal(toBooksAddress({ city: "Centennial null null", state: null, zip: "null" })?.state, undefined);
  assert.equal(formatCityStateZip({ city: "Centennial", state: null, zip: null }), "Centennial");
});
