import assert from "node:assert/strict";
import { test } from "node:test";
import {
  REPS,
  booksSalespersonRows,
  matchBooksSalesperson,
  connectZohoLinkState,
  quoteZohoTokenChoice,
  repByLogin,
  resolveRepBooksSalesperson,
} from "../config/reps.ts";

const AMY_HALEY = "4995712000004391009";
const AMY_STUB = "4995712000035567145";

const liveList = {
  code: 0,
  message: "success",
  data: [
    {
      salesperson_id: AMY_HALEY,
      salesperson_name: "Amy Haley",
      salesperson_email: "amy@scottishwindowtinting.com",
      crm_reference_id: "6168763000003573001",
      is_active: true,
    },
    {
      salesperson_id: AMY_STUB,
      salesperson_name: "Amy",
      salesperson_email: "",
      crm_reference_id: "",
      is_active: true,
    },
    {
      salesperson_id: "4995712000000992001",
      salesperson_name: "Katie Pelowich Faith",
      salesperson_email: "katie@scottishwindowtinting.com",
      crm_reference_id: "6168763000002178001",
      is_active: true,
    },
  ],
};

test("Amy sees Connect Zoho before the connection status returns", () => {
  assert.equal(connectZohoLinkState({ loginId: "amy", connected: false, reconnect: false }), "connect");
  assert.equal(connectZohoLinkState({ loginId: "amy", connected: true, reconnect: false }), "connected");
  assert.equal(connectZohoLinkState({ loginId: "amy", connected: true, reconnect: true }), "reconnect");
  assert.equal(connectZohoLinkState({ loginId: "jenny", connected: false, reconnect: false }), "org");
  assert.equal(connectZohoLinkState({ loginId: null, connected: false, reconnect: false }), null);
});

test("a rep without a Zoho connection cannot send, and Jenny uses the organization token", () => {
  assert.equal(quoteZohoTokenChoice("amy", false, {}), "blocked");
  assert.equal(quoteZohoTokenChoice("amy", true, {}), "rep");
  assert.equal(quoteZohoTokenChoice("jenny", false, {}), "org");
  assert.equal(quoteZohoTokenChoice("admin", false, {}), "org");
  assert.equal(quoteZohoTokenChoice("amy", false, { ZOHO_ORG_TOKEN_FALLBACK: "true" }), "org");
  assert.equal(quoteZohoTokenChoice("blake", true, { ZOHO_ORG_TOKEN_FALLBACK: "true" }), "rep");
});

test("Amy's committed Books salesperson is Amy Haley", () => {
  const amy = repByLogin("amy");
  assert.equal(amy?.email, "amy@scottishwindowtinting.com");
  assert.equal(amy?.crmUserId, "6168763000003573001");
  assert.equal(amy?.booksSalespersonId, AMY_HALEY);
  assert.equal(amy?.booksSalespersonName, "Amy Haley");
  assert.deepEqual(resolveRepBooksSalesperson("amy", {}), {
    id: AMY_HALEY,
    name: "Amy Haley",
    source: "config",
  });
});

test("an env salesperson id overrides the committed Amy Haley id", () => {
  const resolved = resolveRepBooksSalesperson("amy", {
    ZOHO_BOOKS_SALESPERSON_ID_AMY: " 4995712000099999999 ",
  });
  assert.equal(resolved?.id, "4995712000099999999");
  assert.equal(resolved?.source, "env");
});

test("the live Books list is under data, and email matches Amy Haley rather than the blank Amy row", () => {
  const rows = booksSalespersonRows(liveList);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    matchBooksSalesperson(rows, { email: "Amy@ScottishWindowTinting.com" }),
    { id: AMY_HALEY, name: "Amy Haley" },
  );
});

test("an older salespersons array is still read", () => {
  const rows = booksSalespersonRows({
    salespersons: liveList.data,
  });
  assert.equal(rows.length, 3);
});

test("the name Amy matches Amy Haley when the email is missing from her Books row", () => {
  const rows = booksSalespersonRows({
    data: liveList.data.map((person) =>
      person.salesperson_id === AMY_HALEY ? { ...person, salesperson_email: "" } : person
    ),
  });
  assert.deepEqual(
    matchBooksSalesperson(rows, {
      email: "amy@scottishwindowtinting.com",
      name: "Amy",
      crmUserId: "6168763000003573001",
    }),
    { id: AMY_HALEY, name: "Amy Haley" },
  );
  assert.deepEqual(
    matchBooksSalesperson(rows, { name: "Amy" }),
    { id: AMY_HALEY, name: "Amy Haley" },
  );
  assert.deepEqual(
    matchBooksSalesperson(rows, { name: "Amy Haley" }),
    { id: AMY_HALEY, name: "Amy Haley" },
  );
});

test("email, CRM id, and the name Amy all select Amy Haley from the live list", () => {
  const withoutBooks = REPS.map((rep) =>
    rep.id === "amy" ? { ...rep, booksSalespersonId: null, booksSalespersonName: null } : rep
  );
  const amy = withoutBooks.find((rep) => rep.id === "amy");
  assert.ok(amy);
  assert.deepEqual(
    matchBooksSalesperson(booksSalespersonRows(liveList), {
      email: amy.email,
      name: amy.name,
      crmUserId: amy.crmUserId,
    }),
    { id: AMY_HALEY, name: "Amy Haley" },
  );
});
