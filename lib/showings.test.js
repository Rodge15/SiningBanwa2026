import assert from "node:assert/strict";
import test from "node:test";
import { buildShowingStarts, scheduleFromShowings, validateSchedule } from "./showings.js";

test("builds one showing for each date and time", () => {
  const parsed = validateSchedule({
    startDate: "2026-06-01",
    days: 3,
    times: ["19:00", "14:00", "17:00"],
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.endDate, "2026-06-03");
  assert.equal(parsed.value.starts.length, 9);
  assert.deepEqual(parsed.value.times, ["14:00", "17:00", "19:00"]);
  assert.equal(parsed.value.starts[0], "2026-06-01T06:00:00.000Z");
  assert.equal(parsed.value.starts[8], "2026-06-03T11:00:00.000Z");
});

test("rejects a run that is too long or has a repeated time", () => {
  assert.equal(validateSchedule({ startDate: "2026-06-01", days: 32, times: ["14:00"] }).ok, false);
  assert.equal(validateSchedule({ startDate: "2026-06-01", days: 1, times: ["14:00", "14:00"] }).ok, false);
  assert.equal(validateSchedule({ startDate: "06-01", days: 1, times: ["14:00"] }).ok, false);
});

test("reloads a saved run as start date, day count, and times", () => {
  const starts = buildShowingStarts({ startDate: "2026-06-01", days: 2, times: ["14:00", "19:00"] });
  const schedule = scheduleFromShowings(starts.map((startsAt) => ({ starts_at: startsAt })));

  assert.equal(schedule.startDate, "2026-06-01");
  assert.equal(schedule.days, 2);
  assert.deepEqual(schedule.times, ["14:00", "19:00"]);
});
