// Online sales clock. Asia/Manila. The database function uses the same rules.
// Booking is open at any time of day: staff verify payments later during office
// hours. It is still closed once the show has started, and within 3 hours of the
// start, so a booking always has time to be checked before the show.

export const ONLINE_CUTOFF_MS = 3 * 60 * 60 * 1000;

export const ONLINE_CUTOFF_MESSAGE = "Online booking closes 3 hours before the show starts.";
export const ONLINE_STARTED_MESSAGE = "Online booking is closed because the show has started.";
export const ONLINE_NO_START_MESSAGE = "This show has no start time.";

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

  return null;
}