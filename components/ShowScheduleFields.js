"use client";

import { useState } from "react";
import { fieldClass } from "@/components/formStyles";
import { MAX_RUN_DAYS, MAX_TIMES_PER_DAY } from "@/lib/showings";

export function ShowScheduleFields({ initial }) {
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [days, setDays] = useState(initial?.days || 1);
  const [times, setTimes] = useState(initial?.times?.length ? initial.times : ["14:00"]);

  function updateTime(index, value) {
    setTimes((current) => current.map((time, itemIndex) => (itemIndex === index ? value : time)));
  }

  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium">Show dates and times</legend>
      <p className="text-sm text-muted">
        Each date and time is its own showing. Seats and tickets are counted separately for each one.
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
        {times.length < MAX_TIMES_PER_DAY ? (
          <button type="button" className="text-sm text-brand hover:underline" onClick={() => setTimes((current) => [...current, "19:00"])}>
            Add showtime
          </button>
        ) : null}
      </div>
      <input type="hidden" name="showTimes" value={JSON.stringify(times)} />
    </fieldset>
  );
}
