# SWT Designers / Sales Reps

Source: `ScottishPricing-26_12-Accounts.xlsm` — Film Commission sheet  
Last updated: V-26.12

---

## Designer List

| Name | Location | Glass Commission Rate |
|------|----------|-----------------------|
| Barb | Colorado | 20% |
| Shannon | Texas | 15% |
| Leigh | KS/MO | 10% |
| Amy | Utah | 5% |
| Brooke | Arizona | 5% |
| Vince | Tennessee | — |
| Martin | Georgia | — |
| Derek | California | — |
| Sammy | Wyoming | — |
| Mike | New Mexico | — |
| Office | National | — |

---

## Notes

- **Glass commission rate** applies to stained glass / Scottish Stained Glass jobs, not window film. It is displayed in the designer picker for reference but is not used in the film pricing commission calculation.
- **Film commission** is calculated purely from the pricing group and job total tiers (see `COMMISSION-TIERS.md`). The designer's identity affects the invoice output (name and location shown on proposals) but not the commission rate.
- Designer "Office" is used for jobs booked directly through the office with no assigned sales rep.

---

## Adding a Designer

Add a new entry to the `DESIGNERS` array in `swt-pricing-calculator.jsx`:

```js
{ id: "newrep", name: "New Rep", loc: "State", glassRate: 0.10 }
```

- `id` — unique lowercase identifier (no spaces)
- `name` — display name
- `loc` — location label (city, state, or region)
- `glassRate` — glass commission as a decimal (e.g. `0.10` = 10%), or `null` if not applicable
