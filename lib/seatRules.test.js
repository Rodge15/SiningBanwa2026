import assert from "node:assert/strict";
import test from "node:test";
import {
  effectivePrice,
  formatPeso,
  nestLayoutRows,
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
        tier: "vip",
        sortOrder: 0,
        columnCount: 2,
        posX: 40,
        posY: 40,
        rows: [
          {
            id: id("20"),
            label: "A",
            tier: "vip",
            price: 300,
            sortOrder: 0,
            posX: 56,
            posY: 88,
            seats: [
              { id: id("30"), label: "A1", colIndex: 0, posX: 56, posY: 116, priceOverride: null, status: "available" },
              { id: id("31"), label: "A2", colIndex: 1, posX: 148, posY: 116, priceOverride: 750, status: "blocked" },
            ],
          },
        ],
      },
      {
        id: id("11"),
        name: "Balcony",
        defaultPrice: 300,
        tier: "regular",
        sortOrder: 1,
        columnCount: 1,
        posX: 40,
        posY: 260,
        rows: [
          {
            id: id("21"),
            label: "A",
            tier: "vip",
            price: 250,
            sortOrder: 0,
            posX: 56,
            posY: 308,
            seats: [{ id: id("32"), label: "B-A1", colIndex: 0, posX: 56, posY: 336, priceOverride: null, status: "reserved" }],
          },
        ],
      },
    ],
  };
}

test("keeps a row price and a seat override", () => {
  const parsed = validateLayout(sampleLayout());

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.sections[0].defaultPrice, 500);
  assert.equal(parsed.value.sections[0].rows[0].seats[1].priceOverride, 750);
  assert.equal(effectivePrice(parsed.value.sections[0].rows[0].seats[0], parsed.value.sections[0], parsed.value.sections[0].rows[0]), 300);
  assert.equal(effectivePrice(parsed.value.sections[0].rows[0].seats[1], parsed.value.sections[0], parsed.value.sections[0].rows[0]), 750);
  assert.equal(parsed.value.sections[1].rows[0].price, 250);
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

test("a saved layout reloads with the same design, including a low canvas position", () => {
  const layout = sampleLayout();
  layout.sections[0].posX = 4200;
  layout.sections[0].posY = 5100;
  layout.sections[0].rows[0].posX = 4300;
  layout.sections[0].rows[0].posY = 5200;
  layout.sections[0].rows[0].seats[0].posX = 4400;
  layout.sections[0].rows[0].seats[0].posY = 5300;

  const parsed = validateLayout(layout);
  assert.equal(parsed.ok, true);

  const section = parsed.value.sections[0];
  const row = section.rows[0];
  const reloaded = nestLayoutRows(
    [{
      id: section.id,
      name: section.name,
      default_price: section.defaultPrice,
      tier: section.tier,
      sort_order: section.sortOrder,
      column_count: section.columnCount,
      pos_x: section.posX,
      pos_y: section.posY,
    }],
    [{
      id: row.id,
      section_id: section.id,
      label: row.label,
      tier: row.tier,
      price: row.price,
      sort_order: row.sortOrder,
      pos_x: row.posX,
      pos_y: row.posY,
    }],
    row.seats.map((seat) => ({
      id: seat.id,
      row_id: row.id,
      label: seat.label,
      col_index: seat.colIndex,
      pos_x: seat.posX,
      pos_y: seat.posY,
      price_override: seat.priceOverride,
      status: seat.status,
    })),
  );

  assert.equal(validateLayout(reloaded).ok, true);
  assert.equal(reloaded.sections[0].posX, 4200);
  assert.equal(reloaded.sections[0].posY, 5100);
  assert.equal(reloaded.sections[0].rows[0].seats[0].posX, 4400);
  assert.equal(reloaded.sections[0].rows[0].seats[0].label, row.seats[0].label);
  assert.equal(reloaded.sections[0].rows[0].seats[1].status, "blocked");
});
