import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAudience } from "./audienceRules.js";

test("counts available seats and marks an empty map as not ready", () => {
  const event = { id: "event-1", admission_type: "seated", audience_capacity: 80 };
  const empty = summarizeAudience(event, [], []);
  assert.equal(empty.full, false);
  assert.equal(empty.layoutMissing, true);
  assert.equal(empty.label, "No seats saved");

  const open = summarizeAudience(event, [
    { event_id: "event-1", status: "available" },
    { event_id: "event-1", status: "sold" },
  ], []);
  assert.equal(open.remaining, 1);
  assert.equal(open.label, "1 seats left");
  assert.equal(open.full, false);

  const full = summarizeAudience(event, [{ event_id: "event-1", status: "sold" }], []);
  assert.equal(full.label, "Full");
});

test("counts general admission tickets against capacity", () => {
  const event = { id: "event-2", admission_type: "general", audience_capacity: 5 };
  const result = summarizeAudience(event, [], [
    { event_id: "event-2", status: "awaiting_payment", ticket_quantity: 2 },
    { event_id: "event-2", status: "cancelled", ticket_quantity: 3 },
  ]);
  assert.equal(result.remaining, 3);
  assert.equal(result.label, "3 tickets left");
  assert.equal(result.full, false);
});
