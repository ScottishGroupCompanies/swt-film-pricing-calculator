# Zoho rep and stage mapping

Source of truth in code: `web/src/config/reps.ts`.

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
