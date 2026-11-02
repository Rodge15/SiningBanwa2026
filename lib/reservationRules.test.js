import assert from "node:assert/strict";
import test from "node:test";
import { sumSnapshotPrices, totalsMatch, validateSeatIds, validateStaffBooking } from "./reservationRules.js";

const seatA = "00000000-0000-4000-8000-0000000000a1";
const seatB = "00000000-0000-4000-8000-0000000000b2";

test("accepts one or more seat ids and rejects duplicates", () => {
  assert.equal(validateSeatIds([seatA, seatB]).ok, true);
  assert.equal(validateSeatIds([]).ok, false);
  assert.equal(validateSeatIds([seatA, seatA]).ok, false);
  assert.equal(validateSeatIds(["not-a-seat"]).ok, false);
  assert.equal(validateSeatIds(JSON.stringify([seatA])).ok, true);
});

test("rejects more than 10 seats", () => {
  const ids = Array.from({ length: 11 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return `00000000-0000-4000-8000-0000000000${suffix}`;
  });

  assert.equal(validateSeatIds(ids).ok, false);
});

test("checks a walk-in sale before it reaches the database", () => {
  const missingPhone = validateStaffBooking({
    source: "walk_in",
    customerMode: "new",
    customerName: "Ana Cruz",
    customerPhone: "",
    admissionType: "general",
    quantity: 2,
  });
  const ready = validateStaffBooking({
    source: "admin",
    customerMode: "existing",
    customerId: seatA,
    admissionType: "seated",
    seatIds: [seatB],
  });

  assert.equal(missingPhone.ok, false);
  assert.equal(ready.ok, true);
  assert.equal(ready.value.source, "admin");
  assert.equal(ready.value.customerId, seatA);
});

test("adds snapshot prices and checks the stored total", () => {
  const items = [{ unitPrice: 500 }, { unit_price: "250.50" }];

  assert.equal(sumSnapshotPrices(items), 750.5);
  assert.equal(totalsMatch(750.5, items), true);
  assert.equal(totalsMatch(100, items), false);
});
