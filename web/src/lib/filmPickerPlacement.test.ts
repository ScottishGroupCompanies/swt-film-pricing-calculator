import assert from "node:assert/strict";
import { test } from "node:test";
import { placeFilmPicker } from "./filmPickerPlacement.ts";

test("opens downward and caps height to the space under the trigger", () => {
  const placed = placeFilmPicker({
    trigger: { top: 80, bottom: 120, left: 40 },
    viewportWidth: 1280,
    viewportHeight: 800,
    isMobile: false,
  });
  assert.equal(placed.top, 126);
  assert.equal(placed.bottom, undefined);
  assert.equal(placed.left, 40);
  assert.equal(placed.width, 580);
  assert.equal(placed.maxHeight, 520);
});

test("opens upward when the trigger sits near the bottom of the viewport", () => {
  const placed = placeFilmPicker({
    trigger: { top: 640, bottom: 680, left: 40 },
    viewportWidth: 1280,
    viewportHeight: 800,
    isMobile: false,
  });
  assert.equal(placed.top, undefined);
  assert.equal(placed.bottom, 800 - 640 + 6);
  assert.ok(placed.maxHeight <= 640 - 6 - 12);
  assert.ok(placed.maxHeight > 200);
});

test("shifts a wide panel back inside the right edge", () => {
  const placed = placeFilmPicker({
    trigger: { top: 80, bottom: 120, left: 900 },
    viewportWidth: 1000,
    viewportHeight: 800,
    isMobile: false,
  });
  assert.equal(placed.left, 1000 - 580 - 12);
});

test("uses a narrower panel on a phone and still fits the viewport", () => {
  const placed = placeFilmPicker({
    trigger: { top: 500, bottom: 540, left: 16 },
    viewportWidth: 390,
    viewportHeight: 700,
    isMobile: true,
  });
  assert.equal(placed.width, 366);
  assert.equal(placed.left, 12);
  assert.equal(placed.top, undefined);
  assert.ok((placed.maxHeight ?? 0) <= 500);
});
