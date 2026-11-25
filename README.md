# Scottish Window Tinting — Film Pricing Calculator

A hosted web app for SWT sales reps and designers to calculate window film pricing, commission, and generate printable proposals.

## Live App

**Local dev:** `cd web && npm run dev` → http://localhost:3000

**Deploy to Vercel:**
```bash
cd web
npm install -g vercel   # if not installed
vercel                  # follow prompts, point to the /web directory
vercel --prod           # deploy to production
```

Or connect the GitHub repo to Vercel for automatic deployments on push.

---

## Architecture

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, fonts, metadata
│   │   ├── page.tsx            # Renders <PricingCalculator />
│   │   └── globals.css        # Base styles
│   ├── components/
│   │   └── PricingCalculator.tsx  # Main calculator UI (client component)
│   └── lib/
│       ├── pricingData.ts     # All films, pricing groups, commission tiers, designers
│       └── proposal.ts        # Client-side proposal generation + print/export
├── package.json
└── next.config.ts
```

### Tech Stack
- **Next.js 16** (App Router, TypeScript)
- **React 19** (hooks, inline styles — no CSS framework)
- **No external API dependencies** — all calculations and proposal generation happen client-side
- **Inter** font via `next/font/google`

---

## Features

- **295 films** from Vista, 3M, Huper Optik, and LLumar — searchable by name, grouped by brand
- **Per-row film selection** — each window can use a different film
- **10 pricing groups** with exact $/SF rates
- **Roll width logic** — smallest of 36/48/60/72" ≥ window width
- **Minimum dimension** — defaults to 8", editable per job
- **Minimum job price** — $250 enforced, adjustment shown in summary
- **Tiered commission** — rate based on highest pricing group × total job value
- **Client-side proposal generation** — no AI/API needed:
  - **Customer proposal** — professional, no internal cost data
  - **Internal record** — full technical details with commission breakdown
- **Print / Save as PDF** — formatted printable proposal via browser print
- **Download** — export proposal as .txt or .html
- **Designer selector** — 11 designers with location and glass commission rate

---

## Key Business Rules

| Rule | Value |
|------|-------|
| Roll widths | 36" through 144", smallest roll that fits the cut |
| Charged SF | Cheapest of the Film Pricing sheet's cut options (rows 26–41) |
| Sell rate | Workbook group rate × 1.03. Group 7 starts at $28.40 (V-10.8), then × 1.03 |
| 8" side and $250 minimum | Stained-glass Window Pricing only. Not applied to film |
| Commission basis | Flat rate per rep, on the total after the bulk discount and before the fee |

See `docs/PRICING-LOGIC.md` and `docs/COMMISSION-TIERS.md` for full detail.

---

## Updating Data

### Film Catalog
Edit the `FILMS` array in `web/src/lib/pricingData.ts`:
```ts
{ name: "Film Name", psf: 1.50, pg: 2, brand: "Vista" }
```

### Pricing Groups
Edit `PRICING_GROUPS` in the same file:
```ts
export const PRICING_GROUPS: Record<number, number> = {
  1: 15.73, 2: 16.78, ...
};
```

### Designers
Edit the `DESIGNERS` array:
```ts
{ id: "newrep", name: "New Rep", loc: "State", glassRate: 0.10 }
```

After changes: `npm run build && vercel --prod`

---

## Roadmap

### Phase 1 (current) ✅
- Hosted pricing calculator
- Client-side proposal generation
- Print / export proposals

### Phase 2 (next)
- Sales rep login + job saving
- Agent integration: store pricing data in Zoho Sheet
- Agent creates prospect/opportunity in Zoho CRM
- Agent emails sales rep with confirmation request

### Phase 3 (future)
- Sales rep confirms → updates Google Sheet
- Agent watches Google Sheet for changes
- Agent creates customer invoices + backend invoices in Zoho

---

## Source Data

All pricing data sourced from `data/ScottishPricing-26_12-Accounts.xlsm` (V-26.12).
Documentation in `docs/` contains the full reference for business rules, film catalog, commission tiers, and designer list.

## Original Artifact

The original React component (built for Claude.ai artifacts) is preserved in `app/swt-pricing-calculator.jsx`.
