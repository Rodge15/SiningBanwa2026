// One showing is one date plus one start time. Each showing has its own seats and tickets.

export const MAX_RUN_DAYS = 31;
export const MAX_TIMES_PER_DAY = 8;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function fail(message) {
  return { ok: false, message };
}

export function addCivilDays(dateText, days) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export function manilaParts(iso) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export function formatShowingLabel(iso) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function buildShowingStarts({ startDate, days, times }) {
  const starts = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addCivilDays(startDate, offset);

    for (const time of times) {
      starts.push(new Date(`${date}T${time}:00+08:00`).toISOString());
    }
  }

  return starts;
}

export function validateSchedule(input) {
  const startDate = String(input.startDate || "").trim();
  const days = Number(input.days);
  let times = input.times;

  if (typeof times === "string") {
    try {
      times = JSON.parse(times);
    } catch {
      return fail("Add at least one showtime.");
    }
  }

  if (!DATE_PATTERN.test(startDate)) {
    return fail("Choose the first date of the run.");
  }

  if (!Number.isInteger(days) || days < 1 || days > MAX_RUN_DAYS) {
    return fail(`A run can last 1 to ${MAX_RUN_DAYS} days.`);
  }

  if (!Array.isArray(times) || times.length < 1 || times.length > MAX_TIMES_PER_DAY) {
    return fail(`Add 1 to ${MAX_TIMES_PER_DAY} showtimes per day.`);
  }

  const cleaned = times.map((time) => String(time || "").trim());

  if (cleaned.some((time) => !TIME_PATTERN.test(time))) {
    return fail("Each showtime must be a time such as 14:00.");
  }

  if (new Set(cleaned).size !== cleaned.length) {
    return fail("Showtimes on the same day must be different.");
  }

  const sorted = [...cleaned].sort();
  const endDate = addCivilDays(startDate, days - 1);
  const starts = buildShowingStarts({ startDate, days, times: sorted });

  return {
    ok: true,
    value: {
      startDate,
      endDate,
      days,
      times: sorted,
      starts,
    },
  };
}

export function scheduleFromShowings(showings) {
  const parts = (showings || []).map((showing) => manilaParts(showing.starts_at)).filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const dates = [...new Set(parts.map((item) => item.date))].sort();
  const times = [...new Set(parts.map((item) => item.time))].sort();
  const start = new Date(`${dates[0]}T00:00:00Z`);
  const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  const span = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return {
    startDate: dates[0],
    days: Math.min(Math.max(span, 1), MAX_RUN_DAYS),
    times,
  };
}

export function isMissingShowingSetup(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    /showings|showing_id|replace_event_showings|showing_seats/i.test(message)
  );
}

export function showingSetupMessage() {
  return "Showtimes are not ready. In the Supabase SQL Editor, run supabase/migrations/20261104120000_showings_and_payments.sql once, then refresh.";
}
