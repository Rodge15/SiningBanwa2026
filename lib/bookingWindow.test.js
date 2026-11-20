import assert from "node:assert/strict";
import test from "node:test";
import {
  ONLINE_CUTOFF_MESSAGE,
  ONLINE_STARTED_MESSAGE,
  onlineSalesClosedReason,
} from "./bookingWindow.js";

test("allows a booking more than 3 hours before start", () => {
  const now = new Date("2026-06-01T10:00:00+08:00");
  const start = new Date("2026-06-01T18:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), null);
});

test("allows a booking late at night now that office hours are not enforced", () => {
  const now = new Date("2026-06-01T23:00:00+08:00");
  const start = new Date("2026-06-03T20:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), null);
});

test("allows a booking before 8:00 AM", () => {
  const now = new Date("2026-06-01T05:00:00+08:00");
  const start = new Date("2026-06-02T20:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), null);
});

test("closes 3 hours before the show", () => {
  const now = new Date("2026-06-01T19:00:00+08:00");
  const start = new Date("2026-06-01T21:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_CUTOFF_MESSAGE);
});

test("rejects a show that has already started", () => {
  const now = new Date("2026-06-01T10:30:00+08:00");
  const start = new Date("2026-06-01T10:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_STARTED_MESSAGE);
});