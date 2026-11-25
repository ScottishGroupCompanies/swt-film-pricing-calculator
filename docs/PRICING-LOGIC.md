# SWT Film Pricing — Business Logic & Formulas

All rules sourced from `ScottishPricing-26_12-Accounts.xlsm`, Preferences sheet.

---

## Roll Width Logic

Available roll widths: **36", 48", 60", 72"**

For each window line item, the roll assigned is the **smallest roll width that is greater than or equal to the window width**. Film quotes do not apply the 8" minimum first. That minimum is stained-glass Window Pricing only.

```
getRoll(windowWidth):
  for roll in [36, 48, 60, 72]:
    if windowWidth <= roll: return roll
  return 72  // fallback for very wide windows
```

Examples:
| Window width | Roll assigned |
|---|---|
| 30" | 36" |
| 36" | 36" |
| 37" | 48" |
| 52" | 60" |
| 61" | 72" |
| 74" | 72" (max) |

---

## Charged Square Footage Formula

Charged SF accounts for roll width waste and a 1" height buffer for installation overlap.

```
chargedSF = rollWidth × (height + 1) × qty ÷ 144
```

- `rollWidth` — assigned roll width (inches)
- `height` — window height in inches, as entered
- `qty` — number of identical windows
- `÷ 144` — converts square inches to square feet

**Actual SF** (for reference only, not billed):
```
actualSF = width × height × qty ÷ 144
```

**Wastage SF** = chargedSF − actualSF

---

## Minimum Dimension and Minimum Job Price

Preferences lists an 8" minimum side and a $250 minimum window price. Those rules belong to the stained-glass **Window Pricing** sheet. The Film Pricing formulas do not use them, and the film calculator does not either. A film window is priced at the size the rep enters, and a small film job is not raised to $250.

---

## Customer Price (Pricing Groups)

The customer is charged from the film's pricing group. V-26.12 Price_Group rates:

| Group | Workbook $/SF |
|-------|----------------|
| 1     | $15.73         |
| 2     | $16.78         |
| 3     | $17.83         |
| 4     | $19.86         |
| 5     | $22.88         |
| 6     | $26.13         |
| 7     | $23.40 on this sheet. The calculator uses **$28.40** from the owner's V-10.8 workbook instead. |
| 8     | $33.52         |
| 9     | $39.90         |
| 10    | $45.98         |

The billed rate is that figure times **1.03** (`SELL_RATE_MARKUP` in `web/src/lib/pricing/engine.ts`), rounded to 4 decimal places. That is the same 3% the previous app had already baked into its rates. It is applied only to the $/SF, before the line total. The bulk discount and the 4% fee are calculated after that, on the marked-up dollars. They are not marked up a second time.

| Group | Billed $/SF |
|-------|-------------|
| 1     | 16.2019     |
| 2     | 17.2834     |
| 3     | 18.3649     |
| 4     | 20.4558     |
| 5     | 23.5664     |
| 6     | 26.9139     |
| 7     | 29.252 (28.40 × 1.03) |
| 8     | 34.5256     |
| 9     | 41.097      |
| 10    | 47.3594     |

Line total = `chargedSF × billedRate`

Film total = sum of the line totals. No $250 floor.

---

## Per-Row Film Pricing (Mixed-Film Jobs)

Each window line can use a different film. Each line is priced independently using its own film's pricing group rate. The job total is the sum of all line totals.

A rep can override the pricing group on any individual line if needed (e.g. for custom/special pricing).

---

## Commission

### Commission Basis

The film calculator pays the rep a flat rate from their login, on the subtotal after the bulk discount and before the 4% fee. It does not use a $250 minimum. The table below is the workbook's tier table. On the Film Pricing sheet that same table is the customer bulk discount, not the rep's commission.

If a job has five Group 2 windows and one Group 6 window, the commission rate is looked up using Group 6.

### Tiered Commission Table

Commission rate depends on both:
1. The highest pricing group on the job (rows)
2. The job total (columns/thresholds)

**Groups 1–7:**

| Job Total | Rate |
|-----------|------|
| $0–$499 | 0% |
| $500–$999 | 0% |
| $1,000–$1,499 | 2% |
| $1,500–$1,999 | 5% |
| $2,000–$2,499 | 7% |
| $2,500–$2,999 | 9% |
| $3,000–$3,999 | 12% |
| $4,000–$4,999 | 14% |
| $5,000–$7,499 | 15% |
| $7,500–$9,999 | 16% |
| $10,000–$19,999 | 17% |
| $20,000+ | 17% |

**Groups 8–10** (premium/specialty films):

| Job Total | Rate |
|-----------|------|
| $0–$2,499 | 0% |
| $2,500–$2,999 | 2% |
| $3,000–$3,999 | 4% |
| $4,000–$4,999 | 6% |
| $5,000–$7,499 | 7% |
| $7,500–$9,999 | 8% |
| $10,000–$19,999 | 9% |
| $20,000+ | 10% |

### Commission Formula

```
commissionRate = lookup(highestPricingGroup, jobTotal)
commission = jobTotal × commissionRate
```

---

## Invoice Generation

The calculator uses the Anthropic Claude API (`claude-sonnet-4-6`) to generate two invoice versions:

**Customer version** — Professional proposal format. Includes line items with description and price. Does NOT include: $/SF rates, film cost codes, roll widths, pricing group numbers, or commission.

**Internal version** — Full technical record. Includes everything in the customer version PLUS: film name and brand per line, pricing group, $/SF rate, roll width, actual SF, charged SF, wastage SF, commission amount and rate.
