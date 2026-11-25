// Requires Python packages `formulas` and `openpyxl`. The test asks the
// Film Pricing formulas in data/ScottishPricing-26_12-Accounts.xlsm to
// calculate. Charged square feet must match. Film dollars are that result
// times SELL_RATE_MARKUP, except group 7, whose base rate is $28.40
// (V-10.8) instead of the V-26.12 $23.40, and is then marked up the same way.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { FILMS, BULK_DISCOUNT_THRESHOLDS, PRICING_GROUP_RATES } from "./catalog.ts";
import {
  GROUP_7_SELL_RATE_BEFORE_MARKUP,
  SELL_RATE_MARKUP,
  chargedArea,
  chargedAreaShort,
  priceFilmJob,
  roundSellRate,
  type FilmJobPrice,
} from "./engine.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const oracle = path.join(root, "scripts", "workbook_oracle.py");

const affinity = FILMS.find((film) => film.name.startsWith("Affinity 15"));
const group8 = FILMS.find((film) => film.pg === 8 && film.psf != null);
const group10 = FILMS.find((film) => film.name === "Group 10");

if (!affinity || !group8 || !group10) {
  throw new Error("Workbook catalog is missing a film the pricing tests require.");
}

interface OracleLine {
  film: string;
  width: number;
  height: number;
  qty: number;
}

interface OracleQuote {
  lines: OracleLine[];
  removalSqFt?: number;
  frenchPanes?: number;
  attachment?: number;
  bulkEnabled?: boolean;
  cBond?: boolean;
}

interface OracleLineResult {
  chargedSqFt: number;
  lineTotal: number;
  group: number;
}

interface OracleQuoteResult {
  lines: OracleLineResult[];
  windowTotal: number;
  filmTotal: number;
  highestGroup: number;
  bulkDiscount: number;
  fee: number;
  total: number;
}

function askWorkbook(request: unknown): {
  quotes: OracleQuoteResult[];
  rowCompare: { row16: { chargedSqFt: number; lineTotal: number; t: unknown }; row26: { chargedSqFt: number; lineTotal: number; t: unknown } } | null;
  savedExample: { chargedSqFt: number; lineTotal: number; group: number; filmTotal: number; total: number } | null;
} {
  const stdout = execFileSync("python3", [oracle], {
    input: JSON.stringify(request),
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180_000,
  });
  return JSON.parse(stdout);
}

function close(actual: number, expected: number, label: string): void {
  const gap = Math.abs(actual - expected);
  assert.ok(gap < 1e-6, `${label}: app ${actual} workbook ${expected} (gap ${gap})`);
}

function groupsFor(quote: OracleQuote, groupFor: (line: OracleLine) => number): number[] {
  return quote.lines.filter((line) => line.qty > 0).map(groupFor);
}

/**
 * Charged area matches the workbook. The billed line is that area times the
 * sell rate: workbook $/SF × 1.03, or $28.40 × 1.03 for group 7.
 * Removal, French panes, attachment, and C-Bond are not marked up.
 * When every line uses the plain 3% and the bulk-discount tier does not
 * change, a film-only total equals the workbook total × 1.03.
 */
function expectQuote(
  app: FilmJobPrice,
  workbook: OracleQuoteResult,
  quote: OracleQuote,
  groupFor: (line: OracleLine) => number,
  label: string,
): void {
  const groups = groupsFor(quote, groupFor);
  assert.equal(app.lines.length, workbook.lines.length, `${label} line count`);
  assert.equal(app.lines.length, groups.length, `${label} group count`);
  app.lines.forEach((line, index) => {
    const workbookLine = workbook.lines[index];
    const group = groups[index];
    const workbookRate = PRICING_GROUP_RATES[group];
    const base = group === 7 ? GROUP_7_SELL_RATE_BEFORE_MARKUP : workbookRate;
    const billed = roundSellRate(base * SELL_RATE_MARKUP);
    close(line.chargedSqFt, workbookLine.chargedSqFt, `${label} line ${index} charged SF`);
    close(line.pricingGroup ?? 0, workbookLine.group, `${label} line ${index} group`);
    close(workbookLine.lineTotal, workbookLine.chargedSqFt * workbookRate, `${label} line ${index} workbook price`);
    close(line.ratePerSqFt ?? 0, billed, `${label} line ${index} sell rate`);
    close(line.lineTotal, line.chargedSqFt * billed, `${label} line ${index} price`);
  });
  close(app.highestGroup, workbook.highestGroup, `${label} highest group`);
  const workbookExtras = workbook.filmTotal - workbook.windowTotal;
  close(app.filmTotal - app.windowTotal, workbookExtras, `${label} unscaled removal and french panes`);
  const pureFilm = Math.abs(workbookExtras) < 1e-9
    && !(quote.attachment)
    && !quote.cBond
    && groups.every((group) => group !== 7);
  if (pureFilm && workbook.windowTotal > 0) {
    close(app.windowTotal, workbook.windowTotal * SELL_RATE_MARKUP, `${label} window total x 1.03`);
    const workbookRate = workbook.filmTotal > 0 ? workbook.bulkDiscount / workbook.filmTotal : 0;
    if (Math.abs(workbookRate - app.bulkDiscountRate) < 1e-9) {
      close(app.bulkDiscount, workbook.bulkDiscount * SELL_RATE_MARKUP, `${label} bulk discount x 1.03`);
      close(app.fee, workbook.fee * SELL_RATE_MARKUP, `${label} fee x 1.03`);
      close(app.total, workbook.total * SELL_RATE_MARKUP, `${label} total x 1.03`);
    }
  }
  if (app.lines.length === 0) {
    close(app.filmTotal, workbook.filmTotal, `${label} film total`);
    close(app.bulkDiscount, workbook.bulkDiscount, `${label} bulk discount`);
    close(app.fee, workbook.fee, `${label} fee`);
    close(app.total, workbook.total, `${label} total`);
  }
}

function appQuote(quote: OracleQuote, groupFor: (line: OracleLine) => number): FilmJobPrice {
  return priceFilmJob({
    lines: quote.lines.map((line) => ({
      widthInches: line.width,
      heightInches: line.height,
      qty: line.qty,
      pricingGroup: groupFor(line),
    })),
    removalSqFt: quote.removalSqFt,
    frenchPanes: quote.frenchPanes,
    attachment: quote.attachment,
    bulkDiscountEnabled: quote.bulkEnabled,
    cBond: quote.cBond,
  });
}

const geometry: OracleQuote = {
  lines: [
    { film: affinity.name, width: 25, height: 30, qty: 1 },
    { film: affinity.name, width: 35, height: 30, qty: 1 },
    { film: affinity.name, width: 36, height: 30, qty: 1 },
    { film: affinity.name, width: 47, height: 30, qty: 1 },
    { film: affinity.name, width: 48, height: 30, qty: 1 },
    { film: affinity.name, width: 59, height: 20, qty: 1 },
    { film: affinity.name, width: 60, height: 20, qty: 1 },
    { film: affinity.name, width: 71, height: 20, qty: 1 },
    { film: affinity.name, width: 72, height: 20, qty: 1 },
    { film: affinity.name, width: 120, height: 12, qty: 1 },
    { film: affinity.name, width: 144, height: 12, qty: 1 },
    { film: affinity.name, width: 200, height: 12, qty: 1 },
    { film: affinity.name, width: 20, height: 30, qty: 3 },
    { film: affinity.name, width: 23, height: 30, qty: 3 },
    { film: affinity.name, width: 3, height: 4, qty: 1 },
    { film: group8.name, width: 40, height: 50, qty: 2 },
  ],
};

const tierQuotes: { label: string; quote: OracleQuote; group: number }[] = [];
for (const group of [2, 8, 10]) {
  const film = group === 2 ? affinity : group === 8 ? group8 : group10;
  for (const threshold of BULK_DISCOUNT_THRESHOLDS) {
    if (threshold === 0) continue;
    for (const total of [threshold - 1.25, threshold]) {
      tierQuotes.push({
        label: `group ${group} film total ${total}`,
        group,
        quote: {
          lines: [{ film: film.name, width: 1, height: 1, qty: 0 }],
          removalSqFt: total / 1.25,
          bulkEnabled: true,
        },
      });
    }
  }
}

const otherQuotes: { label: string; quote: OracleQuote; groupFor: (line: OracleLine) => number }[] = [
  {
    label: "bulk checkbox off",
    quote: {
      lines: [{ film: affinity.name, width: 1, height: 1, qty: 0 }],
      removalSqFt: 3000 / 1.25,
      bulkEnabled: false,
    },
    groupFor: () => affinity.pg,
  },
  {
    label: "attachment is inside the fee and outside the discount",
    quote: {
      lines: [{ film: affinity.name, width: 25, height: 30, qty: 1 }],
      attachment: 40,
      bulkEnabled: true,
    },
    groupFor: () => affinity.pg,
  },
  {
    label: "highest group is the larger group number",
    quote: {
      lines: [
        { film: affinity.name, width: 25, height: 30, qty: 1 },
        { film: group8.name, width: 30, height: 40, qty: 1 },
      ],
      removalSqFt: 4000 / 1.25,
      bulkEnabled: true,
    },
    groupFor: (line) => (line.film === group8.name ? group8.pg : affinity.pg),
  },
  {
    label: "french panes and c-bond",
    quote: {
      lines: [{ film: affinity.name, width: 25, height: 30, qty: 2 }],
      frenchPanes: 4,
      cBond: true,
      bulkEnabled: true,
    },
    groupFor: () => affinity.pg,
  },
];

test("workbook formulas and the pricing engine agree", { timeout: 180_000 }, () => {
  const result = askWorkbook({
    savedExample: true,
    quotes: [geometry, ...tierQuotes.map((entry) => entry.quote), ...otherQuotes.map((entry) => entry.quote)],
    rowCompare: { film: affinity.name, width: 40, height: 10, qty: 3 },
  });

  const saved = result.savedExample;
  assert.ok(saved);
  close(saved.chargedSqFt, 6.5, "saved example charged SF");
  close(saved.lineTotal, 109.07, "saved example line price");
  close(saved.group, 2, "saved example group");
  close(saved.total, 113.4328, "saved example total");

  const geometryGroups = (line: OracleLine) => (line.film === group8.name ? group8.pg : affinity.pg);
  expectQuote(appQuote(geometry, geometryGroups), result.quotes[0], geometry, geometryGroups, "geometry");

  tierQuotes.forEach((entry, index) => {
    const groupFor = () => entry.group;
    const app = appQuote(entry.quote, groupFor);
    expectQuote(app, result.quotes[index + 1], entry.quote, groupFor, entry.label);
  });

  otherQuotes.forEach((entry, index) => {
    const app = appQuote(entry.quote, entry.groupFor);
    expectQuote(app, result.quotes[tierQuotes.length + 1 + index], entry.quote, entry.groupFor, entry.label);
  });

  const group2 = priceFilmJob({
    lines: [{ widthInches: 25, heightInches: 30, qty: 1, pricingGroup: 2 }],
  });
  close(group2.lines[0].chargedSqFt, saved.chargedSqFt, "group 2 example charged SF");
  close(group2.lines[0].lineTotal, saved.lineTotal * SELL_RATE_MARKUP, "group 2 example is workbook x 1.03");
  close(group2.lines[0].ratePerSqFt ?? 0, 17.2834, "group 2 sell rate");
  close(group2.total, group2.filmTotal * 1.04, "group 2 fee is 4% after the markup");

  const group7 = priceFilmJob({
    lines: [{ widthInches: 25, heightInches: 30, qty: 1, pricingGroup: 7 }],
  });
  close(group7.lines[0].chargedSqFt, 6.5, "group 7 example charged SF");
  close(group7.lines[0].ratePerSqFt ?? 0, roundSellRate(28.4 * SELL_RATE_MARKUP), "group 7 is 28.40 x 1.03");
  assert.equal(group7.lines[0].ratePerSqFt, 29.252);
  close(group7.lines[0].lineTotal, 6.5 * 29.252, "group 7 example line");
  const fromSheetRate = roundSellRate(PRICING_GROUP_RATES[7] * SELL_RATE_MARKUP);
  assert.notEqual(group7.lines[0].ratePerSqFt, fromSheetRate);

  const compare = result.rowCompare;
  assert.ok(compare);
  const modern = chargedArea(40, 10, 3);
  const early = chargedAreaShort(40, 10, 3);
  assert.ok(modern && early);
  close(modern.chargedSqFt, compare.row26.chargedSqFt, "row 26 charged SF");
  close(early.chargedSqFt, compare.row16.chargedSqFt, "row 16 charged SF");
  assert.ok(compare.row26.chargedSqFt < compare.row16.chargedSqFt);
  assert.equal(compare.row16.t, "oops");
});
