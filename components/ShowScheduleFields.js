"use client";

import { useMemo, useState } from "react";
import { fieldClass } from "@/components/formStyles";
import { addCivilDays, MAX_RUN_DAYS, MAX_TIMES_PER_DAY } from "@/lib/showings";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function todayManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

function dayLabel(dateText) {
  const parsed = new Date(`${dateText}T12:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function timeLabel(time) {
  const parsed = new Date(`2000-01-01T${time}:00+08:00`);
  if (Number.isNaN(parsed.getTime())) {
    return time;
  }
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function ShowScheduleFields({ initial }) {
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [days, setDays] = useState(initial?.days || 1);
  const [times, setTimes] = useState(initial?.times?.length ? initial.times : ["14:00"]);

  function updateTime(index, value) {
    setTimes((current) => current.map((time, itemIndex) => (itemIndex === index ? value : time)));
  }

  // Build the categorized preview: one group per day, showtimes sorted under it.
  const preview = useMemo(() => {
    const dayCount = Math.min(Math.max(Number.parseInt(days, 10) || 0, 0), MAX_RUN_DAYS);
    const validTimes = [...new Set(times.filter((time) => TIME_PATTERN.test(time)))].sort();

    if (!startDate || dayCount < 1 || validTimes.length === 0) {
      return { groups: [], total: 0, validTimes };
    }

    const groups = [];
    for (let offset = 0; offset < dayCount; offset += 1) {
      const date = addCivilDays(startDate, offset);
      groups.push({ offset, date, label: dayLabel(date), times: validTimes });
    }

    return { groups, total: groups.length * validTimes.length, validTimes };
  }, [startDate, days, times]);

  const pastStart = startDate && startDate < todayManila();
  const duplicateTimes = new Set(times.filter((t) => TIME_PATTERN.test(t))).size !== times.filter((t) => TIME_PATTERN.test(t)).length;

  return (
    <fieldset className="space-y-4 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium">Show dates and times</legend>
      <p className="text-sm text-muted">
        Each date and time is its own showing. Seats and tickets are counted separately for each one.
        The showtimes below apply to every day in the run.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium" htmlFor="runStart">
          First date
          <input
            id="runStart"
            name="runStart"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="text-sm font-medium" htmlFor="runDays">
          Number of days
          <input
            id="runDays"
            name="runDays"
            type="number"
            min={1}
            max={MAX_RUN_DAYS}
            required
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {pastStart ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The first date is in the past (Philippine time). You can still save a draft, but double-check the date before publishing.
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">Showtimes each day (Philippine time)</p>
        {times.map((time, index) => (
          <div key={index} className="flex gap-2">
            <input
              aria-label={`Showtime ${index + 1}`}
              type="time"
              required
              value={time}
              onChange={(event) => updateTime(index, event.target.value)}
              className={fieldClass}
            />
            {times.length > 1 ? (
              <button
                type="button"
                className="text-sm text-muted hover:underline"
                onClick={() => setTimes((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        {duplicateTimes ? (
          <p className="text-xs text-red-700">Two showtimes are the same. Showtimes on the same day must be different.</p>
        ) : null}
        {times.length < MAX_TIMES_PER_DAY ? (
          <button type="button" className="text-sm text-brand hover:underline" onClick={() => setTimes((current) => [...current, "19:00"])}>
            Add showtime
          </button>
        ) : null}
      </div>

      {/* Categorized preview: the admin sees exactly which dates and showings will be created. */}
      <div className="space-y-2 rounded-lg border border-dashed border-line bg-card/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Schedule preview</p>
          {preview.total > 0 ? (
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              {preview.total} showing{preview.total === 1 ? "" : "s"} · {preview.groups.length} day
              {preview.groups.length === 1 ? "" : "s"} · {preview.validTimes.length} time
              {preview.validTimes.length === 1 ? "" : "s"}/day
            </span>
          ) : null}
        </div>

        {preview.total === 0 ? (
          <p className="text-xs text-muted">
            Pick a first date, the number of days, and at least one showtime to see the schedule here.
          </p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {preview.groups.map((group) => (
              <li key={group.date} className="rounded-lg border border-line bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand">Day {group.offset + 1}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{group.label}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.times.map((time) => (
                    <span
                      key={time}
                      className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
                    >
                      {timeLabel(time)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <input type="hidden" name="showTimes" value={JSON.stringify(times)} />
    </fieldset>
  );
}