# SWT Film Pricing — Business Logic & Formulas

All rules sourced from `ScottishPricing-26_12-Accounts.xlsm`, Preferences sheet.

---

## Roll Width Logic

Available roll widths: **36", 48", 60", 72"**

For each window line item, the roll assigned is the **smallest roll width that is greater than or equal to the window width** (after minimum dimension is applied).

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
- `height` — window height in inches (after min dim applied)
- `qty` — number of identical windows
- `÷ 144` — converts square inches to square feet

**Actual SF** (for reference only, not billed):
```
actualSF = width × height × qty ÷ 144
```

**Wastage SF** = chargedSF − actualSF

---

## Minimum Dimension

**Default: 8 inches** (from Preferences sheet)

Any window dimension (width OR height) smaller than the minimum is treated as the minimum for calculation purposes. This applies before roll width selection.

```
effectiveWidth  = max(inputWidth,  minDim)
effectiveHeight = max(inputHeight, minDim)
```

The minimum dimension is editable in the calculator header for non-standard jobs.

---

## Minimum Job Price

**$250.00**

If the calculated job total is below $250, the total is adjusted up to $250. The adjustment is shown separately in the summary so the rep can see what was added.

---

## Customer Price (Pricing Groups)

The customer is charged based on the **pricing group** of each film, not the film's raw cost. Each pricing group has a fixed $/SF rate:

| Group | Customer $/SF |
|-------|--------------|
| 1     | $15.73       |
| 2     | $16.78       |
| 3     | $17.83       |
| 4     | $19.86       |
| 5     | $22.88       |
| 6     | $26.13       |
| 7     | $23.40       |
| 8     | $33.52       |
| 9     | $39.90       |
| 10    | $45.98       |

Line total = `chargedSF × groupRate`

Job total = sum of all line totals, floored at $250 minimum.

---

## Per-Row Film Pricing (Mixed-Film Jobs)

Each window line can use a different film. Each line is priced independently using its own film's pricing group rate. The job total is the sum of all line totals.

A rep can override the pricing group on any individual line if needed (e.g. for custom/special pricing).

---

## Commission

### Commission Basis

Commission is calculated on the **full job total** (after minimum price adjustment), using the **highest pricing group present** anywhere on the job.

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
