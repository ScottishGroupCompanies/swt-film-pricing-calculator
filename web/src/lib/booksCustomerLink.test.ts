import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOKS_CUSTOMER_LINK_WARNING,
  resolveBooksCustomerLink,
  type BooksCustomerLinkClient,
  type LinkedBooksCustomer,
} from "./booksCustomerLink.ts";

function client(overrides: Partial<BooksCustomerLinkClient> = {}): BooksCustomerLinkClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    importAccount: async () => { calls.push("importAccount"); throw new Error("not imported"); },
    importContact: async () => { calls.push("importContact"); throw new Error("not imported"); },
    findByAccountId: async () => { calls.push("findByAccountId"); return null; },
    findByContactId: async () => { calls.push("findByContactId"); return null; },
    findByName: async () => { calls.push("findByName"); return null; },
    createUnlinked: async () => { calls.push("createUnlinked"); return "unlinked-new"; },
    ...overrides,
  };
}

test("a new CRM account is imported into Books instead of creating an unlinked customer", async () => {
  const fake = client({
    importAccount: async (accountId) => {
      assert.equal(accountId, "acc-1");
      return "books-77";
    },
  });
  const result = await resolveBooksCustomerLink(fake, {
    accountId: "acc-1",
    contactId: "con-1",
    customerName: "Jenny Riemer -TEST",
  });
  assert.deepEqual(result, { customerId: "books-77", linked: true, via: "crm-account-import" });
  assert.deepEqual(fake.calls, []);
});

test("an already-imported account is reused when import fails", async () => {
  const existing: LinkedBooksCustomer = { id: "books-9", zcrmAccountId: "acc-1", zcrmContactId: "con-1" };
  const fake = client({
    findByAccountId: async () => existing,
  });
  const result = await resolveBooksCustomerLink(fake, { accountId: "acc-1", customerName: "Jenny" });
  assert.equal(result.linked, true);
  assert.equal(result.customerId, "books-9");
  assert.equal(result.via, "existing-crm-account");
  assert.equal(fake.calls.includes("createUnlinked"), false);
});

test("a repeat customer found by name is linked when the Books record carries the CRM id", async () => {
  const fake = client({
    findByName: async () => ({ id: "books-3", zcrmAccountId: "acc-old", zcrmContactId: null }),
  });
  const result = await resolveBooksCustomerLink(fake, { customerName: "Molly Brown" });
  assert.equal(result.linked, true);
  assert.equal(result.via, "existing-by-name");
  assert.equal(result.warning, undefined);
});

test("when import and lookup both miss, the estimate still gets created and the UI is warned", async () => {
  const fake = client();
  const result = await resolveBooksCustomerLink(fake, {
    accountId: "acc-new",
    contactId: "con-new",
    customerName: "Jenny Riemer -TEST",
  });
  assert.equal(result.linked, false);
  assert.equal(result.via, "unlinked-create");
  assert.equal(result.customerId, "unlinked-new");
  assert.equal(result.warning, BOOKS_CUSTOMER_LINK_WARNING);
  assert.match(result.warning, /Zoho Finance/);
});

test("a name match linked to a different CRM account is not reused", async () => {
  const fake = client({
    findByName: async () => ({ id: "books-other", zcrmAccountId: "someone-else", zcrmContactId: null }),
  });
  const result = await resolveBooksCustomerLink(fake, {
    accountId: "acc-new",
    customerName: "Jenny",
  });
  assert.equal(result.via, "unlinked-create");
  assert.equal(result.customerId, "unlinked-new");
  assert.equal(result.linked, false);
});

test("an unlinked name match is reused so we don't create a second duplicate, with a warning", async () => {
  const fake = client({
    findByName: async () => ({ id: "books-bare", zcrmAccountId: null, zcrmContactId: null }),
  });
  const result = await resolveBooksCustomerLink(fake, {
    accountId: "acc-new",
    customerName: "Jenny - TEst",
  });
  assert.equal(result.via, "unlinked-name");
  assert.equal(result.customerId, "books-bare");
  assert.equal(result.linked, false);
  assert.equal(result.warning, BOOKS_CUSTOMER_LINK_WARNING);
  assert.equal(fake.calls.includes("createUnlinked"), false);
});
