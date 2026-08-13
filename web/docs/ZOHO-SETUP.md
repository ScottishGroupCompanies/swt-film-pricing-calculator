# Zoho Integration Setup Guide

This guide walks you through setting up Zoho API credentials so the SWT Pricing Calculator can submit pricing data to Zoho CRM + Zoho Sheet and email reps automatically.

---

## Step 1: Create a Zoho API Console Application

1. Go to **https://api-console.zoho.com** (log in with your Zoho CRM admin account)
2. Click **"Add Client"** → choose **"Server-based Applications"**
3. Fill in:
   - **Client Name:** `SWT Pricing Calculator`
   - **Homepage URL:** `https://scottishwindowtinting.com`
   - **Authorized Redirect URIs:** `https://api-console.zoho.com/redirect`
4. Click **"Create"**
5. You'll see your **Client ID** and **Client Secret** — save these for later

---

## Step 2: Generate a Refresh Token

Zoho uses OAuth 2.0. You need a refresh token (lasts indefinitely) to generate access tokens (last 1 hour).

### Option A — Self-Client (easiest)

1. In the API Console, go to **"Self-Client"** tab
2. In the **"Scope"** field, paste:
   ```
   ZohoCRM.modules.contacts.CREATE,ZohoCRM.modules.deals.CREATE,ZohoCRM.modules.notes.CREATE,ZohoCRM.modules.contacts.READ,ZohoSheet.workbooks.ALL
   ```
3. Set **Expiry Time** to `1000000` minutes (max)
4. Click **"View Token"**
5. Copy the **Refresh Token** — this is what goes in your env vars

### Option B — Manual OAuth Flow

1. Open this URL in your browser (replace `CLIENT_ID`):
   ```
   https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.contacts.CREATE,ZohoCRM.modules.deals.CREATE,ZohoCRM.modules.notes.CREATE,ZohoCRM.modules.contacts.READ,ZohoSheet.workbooks.ALL&client_id=CLIENT_ID&response_type=code&access_type=offline&redirect_uri=https://api-console.zoho.com/redirect
   ```
2. Click **"Accept"**
3. Copy the authorization code from the redirect URL
4. Exchange it for tokens:
   ```bash
   curl -X POST https://accounts.zoho.com/oauth/v2/token \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "redirect_uri=https://api-console.zoho.com/redirect" \
     -d "code=AUTH_CODE"
   ```
5. Save the `refresh_token` from the response

---

## Step 3: Find Your Zoho Sheet Workbook ID

1. Open **Zoho Sheet** (sheet.zoho.com)
2. Create or open the workbook where you want pricing rows stored
3. Look at the URL: `https://sheet.zoho.com/open/[WORKBOOK_ID]`
4. Copy the workbook ID (the alphanumeric string)
5. Note the worksheet/tab name (e.g., "Pricing", "Sheet1")

---

## Step 4: Set Up Email (SMTP)

The calculator sends notification emails to Amy/Blake when a prospect is added.

### For Gmail:

1. Go to **https://myaccount.google.com/apppasswords**
2. Generate a new App Password (16 characters)
3. Use this as your SMTP_PASS

### For other providers:

Use your email provider's SMTP settings. Common ones:
- **Outlook/Office365:** `smtp.office365.com`, port 587
- **Zoho Mail:** `smtp.zoho.com`, port 587

---

## Step 5: Configure Environment Variables

### For local development:

1. Copy `.env.example` to `.env.local` in the `web/` directory:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in all values:
   ```
   ZOHO_CLIENT_ID=1000.XXXXXXXXXXXXXXXX
   ZOHO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ZOHO_REFRESH_TOKEN=1000.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ZOHO_SHEET_WORKBOOK_ID=abc123def456
   ZOHO_SHEET_WORKSHEET_NAME=Pricing
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_16_char_app_password
   SMTP_FROM=your_email@gmail.com
   REP_EMAIL_AMY=amy@scottishwindowtinting.com
   REP_EMAIL_BLAKE=blake@scottishwindowtinting.com
   ```

3. Restart the dev server:
   ```bash
   npm run dev
   ```

### For Vercel production:

1. Go to your project at **vercel.com** → Settings → Environment Variables
2. Add each variable from the `.env.example` file
3. Redeploy

---

## Step 6: Test the Integration

1. Open the calculator at `http://localhost:3000`
2. Select a designer (Amy or Blake)
3. Add windows with films and dimensions
4. You should see a **"📤 Submit to Zoho CRM"** button in the sidebar
5. Click it — you should see:
   - "Submitting to Zoho…"
   - "✅ Submitted to Zoho CRM!" with Deal ID
   - "Sheet row added ✅"
   - "Email sent to [designer name]"
6. Check Zoho CRM — a new Contact and Deal should appear
7. Check Zoho Sheet — a new row should be appended
8. Check the rep's email — a notification should arrive

---

## Troubleshooting

### "Zoho integration not configured"
- Missing env vars. Run `GET /api/zoho/health-check` to see what's missing.

### "Zoho token refresh failed"
- Your refresh token may be expired or invalid. Re-generate it (Step 2).

### "Zoho CRM API error (401)"
- Access token invalid. The client auto-refreshes, but if the refresh token is bad, it fails.

### "Zoho CRM API error (403)"
- Wrong API scopes. Make sure you included all scopes in Step 2.

### Email not sending
- Check SMTP credentials. For Gmail, you MUST use an App Password, not your regular password.

### Sheet row not adding
- Verify the Workbook ID and Worksheet name match exactly what's in Zoho Sheet.

---

## API Scopes Reference

| Scope | Purpose |
|-------|---------|
| `ZohoCRM.modules.contacts.CREATE` | Create contacts |
| `ZohoCRM.modules.contacts.READ` | Search for existing contacts |
| `ZohoCRM.modules.deals.CREATE` | Create deals/opportunities |
| `ZohoCRM.modules.notes.CREATE` | Add notes to deals |
| `ZohoSheet.workbooks.ALL` | Read/write Zoho Sheet data |

---

## Datacenter Reference

If your Zoho account is NOT in the US, change `ZOHO_DATACENTER`:

| Datacenter | Value | Accounts URL |
|-----------|-------|-------------|
| US | `com` | accounts.zoho.com |
| EU | `eu` | accounts.zoho.eu |
| India | `in` | accounts.zoho.in |
| Australia | `com.au` | accounts.zoho.com.au |

---

## Connecting to Production Zoho — "Fill Out Estimate" Feature

The calculator has a **"📝 Fill Out Estimate in Zoho"** button that creates a
real Estimate with itemized line items, quantities, rates, and amounts,
linked to the Opportunity, and opens it directly for the rep to review.

**CONFIRMED FROM LIVE PRODUCTION INSPECTION (Aug 2026):** the itemized
estimate is actually powered by **Zoho Books** (a completely separate
Zoho product from CRM, with its own OAuth scope and its own
`organization_id`) — NOT a plain CRM module. Here's the real architecture:

- CRM's Deal ("Opportunity") has field **`Opportunity_Number`** (format
  `WT-03286`) — confirmed real field name from production, e.g. Deal
  `"Molly Brown House Museum 1340 Denver CO AUG26"` had
  `Opportunity_Number: "WT-03295"`.
- CRM also has a custom module `CustomModule5002` labeled "Estimates" —
  this is a **lightweight summary/sync record** (Sub_Total, Grand_Total,
  Account_Name, Contact_Name, Potential_Name lookup back to the Deal) —
  it has **no line-items field at all**. Confirmed by inspecting its full
  layout definition — genuinely no subform or related list for items.
- The real itemized data (Item Details / Category / Quantity / Rate /
  Amount) lives in **Zoho Books**, in the Estimates endpoint
  (`/books/v3/estimates`), linked back to the CRM Deal via
  `zcrm_potential_id`. Zoho's built-in CRM↔Books integration then
  automatically syncs a summary into `CustomModule5002` — no separate
  CRM write needed on our end.
- Books Estimate line items reference real **Items** from Books' own
  Items catalog (`/books/v3/items`) — confirmed catalog includes
  category items like `Frost/Privacy Film`, `Security Film`,
  `Solar Film`, `Graffiti`, `Bird Film`, a catch-all `Other Film`, and
  `Fee (No Tax)` for the 4% fee (the exact description text — "4% fee
  includes shipping, handling, delivery, and energy surcharge." — is
  already used verbatim on real production estimates, matching what our
  PDF generator already produces).
- Books "customers" sync automatically from CRM Contacts/Accounts
  (linked via `zcrm_account_id`/`zcrm_contact_id` on the Books contact
  record) — usually already exist by the time a rep clicks "Fill Out
  Estimate" (since "Send to Zoho Opportunities" just created the CRM
  Contact/Deal). If sync hasn't happened yet, the code creates a
  fallback Books customer directly.

### Env vars needed

```
ZOHO_BOOKS_ORG_ID=848144102          # find via GET /books/v3/organizations
ZOHO_BOOKS_ORG_URL=https://books.zoho.com/app#/848144102   # optional, for direct links
ZOHO_OPPORTUNITY_NUMBER_FIELD=Opportunity_Number   # confirmed real field name
ZOHO_ORG_URL=https://crm.zoho.com/crm/org848141664         # or the Zoho One shell URL
```

`ZOHO_BOOKS_ORG_ID` is the one that actually matters for "Fill Out
Estimate" to work — find it by hitting
`GET https://www.zohoapis.com/books/v3/organizations` with a valid
access token (requires the `ZohoBooks.fullaccess.all` scope on top of
the CRM scopes already in use) and copying `organization_id` for
"Scottish Window Tinting LLC" from the response.

### OAuth scope needed (Self-Client, same process as before)

```
ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.deals.ALL,ZohoCRM.modules.notes.ALL,ZohoCRM.settings.ALL,ZohoCRM.modules.ALL,ZohoBooks.fullaccess.all
```

(The old `ZohoCRM.modules.quotes.ALL` / `ZohoCRM.modules.attachments.ALL`
scopes are no longer needed for this feature — kept only if other parts
of the app still reference them.)

### Legacy / superseded env vars

`ZOHO_ESTIMATE_MODULE`, `ZOHO_ESTIMATE_DEAL_LOOKUP_FIELD`,
`ZOHO_ESTIMATE_PRODUCT_ID` were based on an earlier (incorrect)
assumption that the CRM custom module held line items directly. They're
unused by the current Books-based implementation — safe to leave blank.

Once `ZOHO_BOOKS_ORG_ID` is set (no code changes needed), the "Fill Out
Estimate in Zoho" button starts creating real Books estimates and opening
them for the rep — matching the workflow: rep fills out calculator →
sends to Zoho Opportunities → Opportunity Number appears → clicks
"Fill Out Estimate" → a real, itemized estimate is created in Zoho Books,
linked to that Opportunity, ready for final review/send.
