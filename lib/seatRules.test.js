import assert from "node:assert/strict";
import test from "node:test";
import {
  effectivePrice,
  formatPeso,
  nextRowLabel,
  uniqueSeatLabel,
  validateLayout,
  validateNewSection,
} from "./seatRules.js";

function id(suffix) {
  return `00000000-0000-4000-8000-0000000000${suffix}`;
}

function sampleLayout() {
  return {
    sections: [
      {
        id: id("10"),
        name: "Orchestra",
        defaultPrice: 500,
        sortOrder: 0,
        columnCount: 2,
        rows: [
          {
            id: id("20"),
            label: "A",
            sortOrder: 0,
            seats: [
              { id: id("30"), label: "A1", colIndex: 0, priceOverride: null, status: "available" },
              { id: id("31"), label: "A2", colIndex: 1, priceOverride: 750, status: "blocked" },
            ],
          },
        ],
      },
      {
        id: id("11"),
        name: "Balcony",
        defaultPrice: 300,
        sortOrder: 1,
        columnCount: 1,
        rows: [
          {
            id: id("21"),
            label: "A",
            sortOrder: 0,
            seats: [{ id: id("32"), label: "B-A1", colIndex: 0, priceOverride: null, status: "reserved" }],
          },
        ],
      },
    ],
  };
}

test("keeps section prices and a seat override", () => {
  const parsed = validateLayout(sampleLayout());

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.sections[0].defaultPrice, 500);
  assert.equal(parsed.value.sections[0].rows[0].seats[1].priceOverride, 750);
  assert.equal(effectivePrice(parsed.value.sections[0].rows[0].seats[0], parsed.value.sections[0]), 500);
  assert.equal(effectivePrice(parsed.value.sections[0].rows[0].seats[1], parsed.value.sections[0]), 750);
  assert.match(formatPeso(500), /500/);
});

test("rejects a duplicate seat label in the same event", () => {
  const layout = sampleLayout();
  layout.sections[1].rows[0].seats[0].label = "A1";

  const parsed = validateLayout(layout);

  assert.equal(parsed.ok, false);
  assert.match(parsed.message, /unique/);
});

test("rejects a seat outside the row", () => {
  const layout = sampleLayout();
  layout.sections[0].rows[0].seats[1].colIndex = 5;

  assert.equal(validateLayout(layout).ok, false);
});

test("rejects a negative section price", () => {
  const parsed = validateNewSection({ name: "Orchestra", defaultPrice: -1, columnCount: 4, rowCount: 2 });

  assert.equal(parsed.ok, false);
});

test("builds the next unused row label and a unique seat label", () => {
  assert.equal(nextRowLabel(["A", "B"]), "C");
  assert.equal(uniqueSeatLabel(["A1", "A1-2"], "A1"), "A1-3");
});
