// Online sales clock. Asia/Manila. The database function uses the same rules.
// Open from 8:00 AM up to, but not including, 8:00 PM.
// Also closed from 3 hours before the show start. The earlier close wins.

export const BOOKING_OPEN_MINUTES = 8 * 60;
export const BOOKING_CLOSE_MINUTES = 20 * 60;
export const ONLINE_CUTOFF_MS = 3 * 60 * 60 * 1000;

export const ONLINE_WINDOW_MESSAGE = "Online booking is open only from 8:00 AM to 8:00 PM.";
export const ONLINE_CUTOFF_MESSAGE = "Online booking closes 3 hours before the show starts.";
export const ONLINE_STARTED_MESSAGE = "Online booking is closed because the show has started.";
export const ONLINE_NO_START_MESSAGE = "This show has no start time.";

function manilaMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value || "0");

  return part("hour") * 60 + part("minute");
}

export function onlineSalesClosedReason(startsAt, now = new Date()) {
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    return ONLINE_NO_START_MESSAGE;
  }

  if (now.getTime() >= start.getTime()) {
    return ONLINE_STARTED_MESSAGE;
  }

  if (now.getTime() >= start.getTime() - ONLINE_CUTOFF_MS) {
    return ONLINE_CUTOFF_MESSAGE;
  }

  const minutes = manilaMinutes(now);

  if (minutes < BOOKING_OPEN_MINUTES || minutes >= BOOKING_CLOSE_MINUTES) {
    return ONLINE_WINDOW_MESSAGE;
  }

  return null;
}
