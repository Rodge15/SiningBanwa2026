import assert from "node:assert/strict";
import test from "node:test";
import {
  ONLINE_CUTOFF_MESSAGE,
  ONLINE_STARTED_MESSAGE,
  ONLINE_WINDOW_MESSAGE,
  onlineSalesClosedReason,
} from "./bookingWindow.js";

test("allows a booking inside the Manila window and more than 3 hours before start", () => {
  const now = new Date("2026-06-01T10:00:00+08:00");
  const start = new Date("2026-06-01T18:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), null);
});

test("closes at 8:00 PM even when the show is still far away", () => {
  const now = new Date("2026-06-01T20:00:00+08:00");
  const start = new Date("2026-06-02T20:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_WINDOW_MESSAGE);
});

test("closes 3 hours before the show when that time is earlier than 8:00 PM", () => {
  const now = new Date("2026-06-01T19:00:00+08:00");
  const start = new Date("2026-06-01T21:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_CUTOFF_MESSAGE);
});

test("stays closed before 8:00 AM", () => {
  const now = new Date("2026-06-01T07:59:00+08:00");
  const start = new Date("2026-06-01T20:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_WINDOW_MESSAGE);
});

test("rejects a show that has already started", () => {
  const now = new Date("2026-06-01T10:30:00+08:00");
  const start = new Date("2026-06-01T10:00:00+08:00");

  assert.equal(onlineSalesClosedReason(start, now), ONLINE_STARTED_MESSAGE);
});
