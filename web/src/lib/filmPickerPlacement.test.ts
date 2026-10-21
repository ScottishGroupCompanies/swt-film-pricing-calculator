import assert from "node:assert/strict";
import { test } from "node:test";
import { placeFilmPicker, type FilmPickerPlacement } from "./filmPickerPlacement.ts";

const PAD = 12;

function assertFullyInside(placed: FilmPickerPlacement, viewportWidth: number, viewportHeight: number) {
  assert.ok(placed.width > 0, `width ${placed.width}`);
  assert.ok(placed.height > 0, `height ${placed.height}`);
  assert.ok(placed.left >= PAD, `left ${placed.left}`);
  assert.ok(placed.top >= PAD, `top ${placed.top}`);
  assert.ok(placed.left + placed.width <= viewportWidth - PAD, `right ${placed.left + placed.width} > ${viewportWidth - PAD}`);
  assert.ok(placed.top + placed.height <= viewportHeight - PAD, `bottom ${placed.top + placed.height} > ${viewportHeight - PAD}`);
}

test("opens downward under a first row when there is room below", () => {
  const placed = placeFilmPicker({
    trigger: { top: 180, bottom: 216, left: 420 },
    viewportWidth: 1440,
    viewportHeight: 900,
    isMobile: false,
  });
  assert.equal(placed.centered, false);
  assert.ok(placed.top >= 216);
  assert.equal(placed.left, 420);
  assert.equal(placed.width, 580);
  assert.equal(placed.height, 480);
  assertFullyInside(placed, 1440, 900);
});

test("opens upward above a last row on a 1280x720 laptop", () => {
  const placed = placeFilmPicker({
    trigger: { top: 640, bottom: 676, left: 360 },
    viewportWidth: 1280,
    viewportHeight: 720,
    isMobile: false,
  });
  assert.equal(placed.centered, false);
  assert.ok(placed.top + placed.height <= 640);
  assertFullyInside(placed, 1280, 720);
});

test("keeps the whole panel inside at laptop sizes for first row, last row, and a long list", () => {
  const viewports = [
    { viewportWidth: 1280, viewportHeight: 720 },
    { viewportWidth: 1440, viewportHeight: 900 },
  ];
  for (const viewport of viewports) {
    const { viewportWidth, viewportHeight } = viewport;
    const triggers = [
      { top: 80, bottom: 116, left: 280 },
      { top: viewportHeight - 80, bottom: viewportHeight - 44, left: 280 },
      { top: viewportHeight + 900, bottom: viewportHeight + 936, left: 280 },
      { top: 40, bottom: 76, left: viewportWidth - 80 },
    ];
    for (const trigger of triggers) {
      const placed = placeFilmPicker({ trigger, ...viewport, isMobile: false });
      assertFullyInside(placed, viewportWidth, viewportHeight);
    }
  }
});

test("centers the panel when the trigger is scrolled off the page", () => {
  const placed = placeFilmPicker({
    trigger: { top: 1800, bottom: 1836, left: 400 },
    viewportWidth: 1280,
    viewportHeight: 720,
    isMobile: false,
  });
  assert.equal(placed.centered, true);
  assertFullyInside(placed, 1280, 720);
});

test("shifts a wide panel back inside the right edge", () => {
  const placed = placeFilmPicker({
    trigger: { top: 80, bottom: 116, left: 900 },
    viewportWidth: 1000,
    viewportHeight: 800,
    isMobile: false,
  });
  assert.equal(placed.left, 1000 - 580 - 12);
  assertFullyInside(placed, 1000, 800);
});

test("uses a narrower panel on a phone and still fits the viewport", () => {
  const placed = placeFilmPicker({
    trigger: { top: 500, bottom: 536, left: 16 },
    viewportWidth: 390,
    viewportHeight: 700,
    isMobile: true,
  });
  assert.equal(placed.width, 390 - 24);
  assert.equal(placed.left, 12);
  assert.ok(placed.top + placed.height <= 700 - 12);
  assertFullyInside(placed, 390, 700);
});
