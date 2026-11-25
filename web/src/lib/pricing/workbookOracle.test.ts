// Requires Python packages `formulas` and `openpyxl`. The test asks the
// Film Pricing formulas in data/ScottishPricing-26_12-Accounts.xlsm to
// calculate, then compares those numbers to the app.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { FILMS, BULK_DISCOUNT_THRESHOLDS } from "./catalog.ts";
import { chargedArea, chargedAreaShort, priceFilmJob, type FilmJobPrice } from "./engine.ts";

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

function expectQuote(app: FilmJobPrice, workbook: OracleQuoteResult, label: string): void {
  close(app.windowTotal, workbook.windowTotal, `${label} window total`);
  close(app.filmTotal, workbook.filmTotal, `${label} film total`);
  close(app.highestGroup, workbook.highestGroup, `${label} highest group`);
  close(app.bulkDiscount, workbook.bulkDiscount, `${label} bulk discount`);
  close(app.fee, workbook.fee, `${label} fee`);
  close(app.total, workbook.total, `${label} total`);
  const priced = app.lines;
  assert.equal(priced.length, workbook.lines.length, `${label} line count`);
  priced.forEach((line, index) => {
    close(line.chargedSqFt, workbook.lines[index].chargedSqFt, `${label} line ${index} charged SF`);
    close(line.lineTotal, workbook.lines[index].lineTotal, `${label} line ${index} price`);
    close(line.pricingGroup ?? 0, workbook.lines[index].group, `${label} line ${index} group`);
  });
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

  expectQuote(
    appQuote(geometry, (line) => (line.film === group8.name ? group8.pg : affinity.pg)),
    result.quotes[0],
    "geometry",
  );

  tierQuotes.forEach((entry, index) => {
    const app = appQuote(entry.quote, () => entry.group);
    expectQuote(app, result.quotes[index + 1], entry.label);
  });

  otherQuotes.forEach((entry, index) => {
    const app = appQuote(entry.quote, entry.groupFor);
    expectQuote(app, result.quotes[tierQuotes.length + 1 + index], entry.label);
  });

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
