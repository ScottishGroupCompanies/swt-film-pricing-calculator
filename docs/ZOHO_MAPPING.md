# Zoho rep and stage mapping

Source of truth in code: `web/src/config/reps.ts`.

Quotes are created with the logged-in rep's own Zoho token, so Created By, the note author, and the Books creator are that rep. Jenny and Admin (`ORG_ZOHO_TOKEN_LOGINS` in `reps.ts`) keep using `ZOHO_REFRESH_TOKEN`. Set `ZOHO_ORG_TOKEN_FALLBACK=true` only if a rep who has not connected should be allowed to send as that organization token. The default blocks the send with "Connect your Zoho account first".

## Two Zoho clients

| Env vars | Client | Used for |
| --- | --- | --- |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | Self Client | Jenny and Admin sends, and any send allowed by `ZOHO_ORG_TOKEN_FALLBACK`. Refreshing that token always uses this client. Do not replace these with the Server-based client. |
| `ZOHO_CONNECT_CLIENT_ID`, `ZOHO_CONNECT_CLIENT_SECRET` | Server-based Application | Connect Zoho: the authorize URL, the callback code exchange, and refreshing a rep's stored token. Both vars must be set. If either is missing, Connect falls back to the Self Client, which other reps cannot authorize. |

The Server-based client's Authorized Redirect URI is `https://swt-film-pricing-calculator.vercel.app/api/zoho/connect/callback`. Add the same path for a preview host only if reps connect there. A Server-based client can be authorized by more than one user in the org. A Self Client cannot.

Each rep logs into the calculator and clicks **Connect Zoho**, then signs into Zoho as themselves. The refresh token is encrypted with `SESSION_SECRET` (or `ZOHO_TOKEN_ENCRYPTION_KEY` if that is set) and stored in the private Vercel Blob store. It is not shown in the browser or the logs. If Zoho revokes it, the next send says **Reconnect Zoho**.

`ZOHO_ORG_TOKEN_FALLBACK=true` lets a rep send before they connect, using the Self Client token. The Connect Zoho button still shows. Jenny and Admin see which logins are connected. Their own sends keep the Self Client token.

Scopes requested, comma-separated with no spaces, from `accounts.zoho.com` (US, same datacenter as `www.zohoapis.com/books/v3`): `ZohoCRM.modules.ALL`, `ZohoCRM.users.READ`, `ZohoSheet.dataAPI.UPDATE`, `ZohoBooks.fullaccess.all`. `access_type=offline` is a separate parameter so Zoho returns a refresh token. `ZohoSheet.workbooks.ALL` is not a Zoho scope and was rejected as "Scope does not exist." Sheet's write scope is `ZohoSheet.dataAPI.UPDATE`. CRM settings are not called when a rep sends a quote, so that scope is not requested.

## Adding a rep

Add one `RepRecord` in `web/src/config/reps.ts` and a matching login in `web/src/lib/auth.ts`. Taylor is not in Zoho Books yet, so do not invent ids. For each new rep collect:

- login id and display name
- email
- Zoho CRM user id (Deal owner)
- Zoho Books salesperson id and name
- Zoho Projects user id, only if a later change sets the project owner (the app does not call Projects today)

No OAuth token goes in the config. The rep connects from the calculator.

`ZOHO_CRM_USER_ID_<LOGIN>` and `ZOHO_BOOKS_SALESPERSON_ID_<LOGIN>` override one login when they are set. They are optional. The ids below are what the app uses when those variables are absent.

Confirmed read-only on 17 Nov 2026. No test records were written. WT-03641 was not modified.

## Reps

CRM user ids are Deal.Owner. Books salesperson ids are the estimate salesperson, not the CRM user id.

| Login | Display name | Email | CRM user id | Books salesperson | Books salesperson id |
| --- | --- | --- | --- | --- | --- |
| dana | Dana | dana@scottishwindowtinting.com | 6168763000003575014 | Dana Hojnacki | 4995712000004410056 |
| amy | Amy | amy@scottishwindowtinting.com | 6168763000003573001 | Amy Haley | 4995712000004391009 |
| blake | Blake | blake@scottishwindowtinting.com | 6168763000003575012 | Blake Parish | 4995712000004415021 |
| katie | Katie | katie@scottishwindowtinting.com | 6168763000002178001 | Katie Pelowich Faith | 4995712000000992001 |
| mike | Mike | mike@scottishwindowtinting.com | 6168763000003583005 | Mike Kinsey | 4995712000004474003 |
| jenny | Jenny | — | 6168763000038970001 | Jenny | 4995712000036111084 |
| admin | Admin | swt.admin@scottishwindowtinting.com | 6168763000000456001 | Scottish Window Tinting Admin | 4995712000000226009 |

Dana, Blake, and Mike emails are the Books salesperson emails whose `crm_reference_id` is that CRM user. Amy and Katie emails are the ones already stored on their logins, and they match those Books rows. Admin matches `swt.admin@scottishwindowtinting.com`. Jenny's Books row has no email and no CRM reference id. There is also a blank salesperson named "Amy" (`4995712000035567145`) with no email; quotes use Amy Haley, not that row.

Books salesperson matching, restored from the Katie/Amy email lookup (PR #2 and PR #7):

1. `ZOHO_BOOKS_SALESPERSON_ID_<LOGIN>` if set.
2. The Books salesperson id in the table above.
3. Otherwise `GET /books/v3/salespersons`. The live org returns the rows in `data` (older responses used `salespersons`). Match the email, then the CRM user id, then the name (`Amy` matches `Amy Haley`).

## Deals Stage

One layout: **Standard** `6168763000000091023`. The app does not send Layout.

No pipeline. `GET /crm/v6/settings/pipeline?layout_id=6168763000000091023` and the v8 call returned 204. The app does not send Pipeline.

`GET /crm/v2/settings/fields?module=Deals` (same on v6, v8, and the Standard layout):

| Display value | Actual value | Reference value | Picklist id | Sent as Deal.Stage |
| --- | --- | --- | --- | --- |
| Discovery | Qualification | Discovery | 6168763000000006801 | Discovery |
| DNQ | Closed Lost to Competition | DNQ | 6168763000000006819 | DNQ |
| Proposal | Value Proposition | Proposal | 6168763000000006805 | Proposal |
| Closed Lost | Closed Lost | Closed Lost | 6168763000000006817 | Closed Lost |
| Closed Won | Closed Won | Closed Won | 6168763000000006815 | Closed Won |

Writing the actual value stores that old name. WT-03641 was created with `Qualification`, and the deal page shows Qualification. Deals that show Discovery have Stage stored as `Discovery`.
