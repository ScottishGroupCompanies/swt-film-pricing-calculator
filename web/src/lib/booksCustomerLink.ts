/**
 * Decide which Zoho Books customer an estimate is billed to.
 *
 * This org syncs "Accounts & its contacts". An estimate only shows up on
 * the CRM Opportunity's Zoho Finance > Estimates list when the Books
 * customer was imported from that Opportunity's CRM account (or contact).
 * Creating a customer with POST /contacts does not set that link, which
 * is why brand-new customers disappeared from the related list while
 * repeat customers (already imported) still showed up.
 */

export interface LinkedBooksCustomer {
  id: string;
  zcrmAccountId: string | null;
  zcrmContactId: string | null;
}

export interface BooksCustomerLinkClient {
  importAccount(accountId: string): Promise<string>;
  importContact(contactId: string): Promise<string>;
  findByAccountId(accountId: string): Promise<LinkedBooksCustomer | null>;
  findByContactId(contactId: string): Promise<LinkedBooksCustomer | null>;
  findByName(name: string): Promise<LinkedBooksCustomer | null>;
  createUnlinked(): Promise<string>;
}

export type BooksCustomerLinkVia =
  | "crm-account-import"
  | "crm-contact-import"
  | "existing-crm-account"
  | "existing-crm-contact"
  | "existing-by-name"
  | "unlinked-name"
  | "unlinked-create";

export interface BooksCustomerLinkResult {
  customerId: string;
  linked: boolean;
  via: BooksCustomerLinkVia;
  warning?: string;
}

export const BOOKS_CUSTOMER_LINK_WARNING =
  "Estimate created in Zoho Books, but the customer is not linked to the CRM account. It may not appear under this Opportunity's Zoho Finance > Estimates list.";

function sameId(a?: string | null, b?: string | null): boolean {
  return !!a && !!b && String(a) === String(b);
}

export async function resolveBooksCustomerLink(
  client: BooksCustomerLinkClient,
  input: { accountId?: string | null; contactId?: string | null; customerName?: string | null }
): Promise<BooksCustomerLinkResult> {
  const accountId = input.accountId?.trim() || "";
  const contactId = input.contactId?.trim() || "";
  const name = input.customerName?.trim() || "";

  if (accountId) {
    try {
      const imported = (await client.importAccount(accountId))?.trim();
      if (imported) return { customerId: imported, linked: true, via: "crm-account-import" };
    } catch {
      // Already imported, or this org's sync type rejected the call.
      // Look the customer up before creating an unlinked one.
    }
    try {
      const existing = await client.findByAccountId(accountId);
      if (existing?.id) return { customerId: existing.id, linked: true, via: "existing-crm-account" };
    } catch {
      // Lookup is a fallback; import failure is what the warning covers.
    }
  }

  if (contactId) {
    try {
      const imported = (await client.importContact(contactId))?.trim();
      if (imported) return { customerId: imported, linked: true, via: "crm-contact-import" };
    } catch {
      // Accounts-and-contacts orgs reject contact import. That's expected.
    }
    try {
      const existing = await client.findByContactId(contactId);
      if (existing?.id) return { customerId: existing.id, linked: true, via: "existing-crm-contact" };
    } catch {
      // Same as the account lookup: keep going.
    }
  }

  let byName: LinkedBooksCustomer | null = null;
  if (name) {
    try {
      byName = await client.findByName(name);
    } catch {
      byName = null;
    }
  }

  if (byName?.id) {
    const linkedToUs = sameId(byName.zcrmAccountId, accountId) || sameId(byName.zcrmContactId, contactId);
    const linkedToSomeoneElse = !!(byName.zcrmAccountId || byName.zcrmContactId) && !linkedToUs && (!!accountId || !!contactId);
    if (!linkedToSomeoneElse) {
      const linked = linkedToUs || (!accountId && !contactId && !!(byName.zcrmAccountId || byName.zcrmContactId));
      if (linked) return { customerId: byName.id, linked: true, via: "existing-by-name" };
      return {
        customerId: byName.id,
        linked: false,
        via: "unlinked-name",
        warning: BOOKS_CUSTOMER_LINK_WARNING,
      };
    }
  }

  const created = await client.createUnlinked();
  return {
    customerId: created,
    linked: false,
    via: "unlinked-create",
    warning: BOOKS_CUSTOMER_LINK_WARNING,
  };
}
