import assert from "node:assert/strict";
import { test } from "node:test";
import {
  booksSalespersonIdEnvKey,
  crmUserIdEnvKey,
  matchUserIdByEmail,
  readEnvUserOverride,
  resolveDealOwner,
} from "./zohoOwners.ts";

const katie = {
  id: "katie",
  name: "Katie",
  zohoEmail: "katie@scottishwindowtinting.com",
};

test("matches a CRM user by email, ignoring case and surrounding space", () => {
  const id = matchUserIdByEmail(
    [
      { id: "111", email: "amy@scottishwindowtinting.com" },
      { id: "222", email: "  Katie@ScottishWindowTinting.com " },
    ],
    "katie@scottishwindowtinting.com",
  );
  assert.equal(id, "222");
});

test("Katie's owner comes from the email lookup, not a stored id", async () => {
  const resolved = await resolveDealOwner(katie, async () => "6168763000099999001", {});
  assert.deepEqual(resolved, { id: "6168763000099999001", source: "email" });
});

test("an env override wins over the email lookup for that login", async () => {
  let lookups = 0;
  const resolved = await resolveDealOwner(
    katie,
    async () => {
      lookups += 1;
      return "should-not-be-used";
    },
    { ZOHO_CRM_USER_ID_KATIE: " 6168763000011111001 " },
  );
  assert.deepEqual(resolved, { id: "6168763000011111001", source: "env" });
  assert.equal(lookups, 0);
});

test("ZOHO_CRM_USER_IDS maps a login id to a CRM user id", () => {
  const id = readEnvUserOverride("katie", {
    ZOHO_CRM_USER_IDS: JSON.stringify({ katie: "6168763000022222001" }),
  }, "ZOHO_CRM_USER_ID");
  assert.equal(id, "6168763000022222001");
});

test("other users keep their stored Zoho id and do not call the lookup", async () => {
  let lookups = 0;
  const resolved = await resolveDealOwner(
    { id: "jenny", name: "Jenny", zohoUserId: "6168763000038970001" },
    async () => {
      lookups += 1;
      return "nope";
    },
    {},
  );
  assert.deepEqual(resolved, { id: "6168763000038970001", source: "stored" });
  assert.equal(lookups, 0);
});

test("a failed Katie lookup tells the operator which env var to set", async () => {
  await assert.rejects(
    () => resolveDealOwner(katie, async () => {
      throw new Error("Zoho CRM API error (401)");
    }, {}),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /katie@scottishwindowtinting.com/);
      assert.match(err.message, /ZOHO_CRM_USER_ID_KATIE/);
      return true;
    },
  );
});

test("env key helpers are per login id", () => {
  assert.equal(crmUserIdEnvKey("katie"), "ZOHO_CRM_USER_ID_KATIE");
  assert.equal(booksSalespersonIdEnvKey("katie"), "ZOHO_BOOKS_SALESPERSON_ID_KATIE");
});
