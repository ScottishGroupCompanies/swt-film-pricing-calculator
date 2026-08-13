# SWT Commission Tiers

Source: `ScottishPricing-26_12-Accounts.xlsm` — Film Commission sheet  
Last updated: V-26.12

---

## How Commission Works

1. **Commission is calculated on the full job total** (after $250 minimum applied)
2. **The rate is determined by two factors:**
   - The **highest pricing group** present on the job (not the average)
   - The **job total** (which threshold bucket it falls into)
3. On a mixed-film job, the highest group drives the rate for the entire job total

---

## Groups 1–7 Commission Table

| Job Total | Rate |
|-----------|------|
| $0 – $499 | 0% |
| $500 – $999 | 0% |
| $1,000 – $1,499 | 2% |
| $1,500 – $1,999 | 5% |
| $2,000 – $2,499 | 7% |
| $2,500 – $2,999 | 9% |
| $3,000 – $3,999 | 12% |
| $4,000 – $4,999 | 14% |
| $5,000 – $7,499 | 15% |
| $7,500 – $9,999 | 16% |
| $10,000 – $19,999 | 17% |
| $20,000 – $49,999 | 17% |
| $50,000+ | 17% |

---

## Groups 8–10 Commission Table (Premium / Specialty Films)

These groups carry lower commission rates and higher thresholds before commission kicks in.

| Job Total | Rate |
|-----------|------|
| $0 – $499 | 0% |
| $500 – $999 | — (no commission) |
| $1,000 – $1,499 | — (no commission) |
| $1,500 – $1,999 | — (no commission) |
| $2,000 – $2,499 | — (no commission) |
| $2,500 – $2,999 | 2% |
| $3,000 – $3,999 | 4% |
| $4,000 – $4,999 | 6% |
| $5,000 – $7,499 | 7% |
| $7,500 – $9,999 | 8% |
| $10,000 – $19,999 | 9% |
| $20,000 – $49,999 | 10% |
| $50,000+ | 10% |

---

## Examples

**Example 1 — Standard job, Group 2 films only**
- Job total: $3,200
- Highest group: 2 → use Groups 1–7 table
- Rate at $3,000–$3,999: **12%**
- Commission: $3,200 × 12% = **$384.00**

**Example 2 — Mixed job, Group 2 + one Group 6 window**
- Job total: $4,500
- Highest group: 6 → still use Groups 1–7 table
- Rate at $4,000–$4,999: **14%**
- Commission: $4,500 × 14% = **$630.00**

**Example 3 — Premium film job, Group 8**
- Job total: $2,200
- Highest group: 8 → use Groups 8–10 table
- Rate at $2,000–$2,499: **0% (no commission at this total)**
- Commission: $0

**Example 4 — Premium film, higher total**
- Job total: $6,000
- Highest group: 9 → use Groups 8–10 table
- Rate at $5,000–$7,499: **7%**
- Commission: $6,000 × 7% = **$420.00**

---

## Implementation (JavaScript)

```js
const COMM_TIERS = [0,500,1000,1500,2000,2500,3000,4000,5000,7500,10000,20000,50000];
const COMM_RATES = {
  1:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  2:[0,0,0.02,0.05,0.07,0.09,0.12,0.14,0.15,0.16,0.17,0.17],
  // ... groups 3–7 same as group 1–2
  8:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10],
  9:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10],
  10:[0,null,null,null,null,0.02,0.04,0.06,0.07,0.08,0.09,0.10]
};

function getCommRate(highestPg, jobTotal) {
  const rates = COMM_RATES[highestPg];
  let idx = 0;
  for (let i = 0; i < COMM_TIERS.length; i++) {
    if (jobTotal >= COMM_TIERS[i]) idx = i;
  }
  return rates[idx] ?? null; // null = no commission (Groups 8–10 gap)
}
```
