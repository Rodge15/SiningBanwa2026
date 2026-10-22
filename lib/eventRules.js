export const EVENT_STATUSES = ["draft", "published", "completed", "cancelled"];

export const POSTER_MAX_BYTES = 5 * 1024 * 1024;

export const POSTER_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || ""));
}

export function isEventStatus(value) {
  return EVENT_STATUSES.includes(value);
}

export function statusLabel(status) {
  if (!status) {
    return "";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function fieldError(name, message) {
  return { ok: false, field: name, message };
}

export function manilaDateTimeToIso(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return null;
  }

  const parsed = new Date(`${text}:00+08:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const [datePart, timePart] = text.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const check = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type) => Number(check.find((item) => item.type === type)?.value);

  if (
    part("year") !== year ||
    part("month") !== month ||
    part("day") !== day ||
    part("hour") !== hour ||
    part("minute") !== minute
  ) {
    return null;
  }

  return parsed.toISOString();
}

export function toManilaInputValue(iso) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return "";
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

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatManilaDateTime(iso) {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

export function validateEventInput(input) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const venue = String(input.venue || "").trim();
  const startsAt = manilaDateTimeToIso(input.startsAt);

  if (title.length < 3 || title.length > 120) {
    return fieldError("title", "Title must be 3 to 120 characters.");
  }

  if (description.length < 1 || description.length > 5000) {
    return fieldError("description", "Description must be 1 to 5000 characters.");
  }

  if (venue.length < 2 || venue.length > 200) {
    return fieldError("venue", "Venue must be 2 to 200 characters.");
  }

  if (!startsAt) {
    return fieldError("startsAt", "Enter a real start date and time.");
  }

  return {
    ok: true,
    value: { title, description, venue, startsAt },
  };
}

export function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function validatePosterFile(file, bytes) {
  if (!file || file.size === 0) {
    return { ok: true, value: null };
  }

  if (file.size > POSTER_MAX_BYTES) {
    return fieldError("poster", "Poster must be 5 MiB or smaller.");
  }

  const detected = detectImageType(bytes);

  if (!detected || !POSTER_TYPES[detected]) {
    return fieldError("poster", "Poster must be a JPG, PNG, or WebP image.");
  }

  if (file.type && file.type !== "application/octet-stream" && file.type !== detected) {
    return fieldError("poster", "Poster file type does not match its contents.");
  }

  return {
    ok: true,
    value: {
      bytes,
      contentType: detected,
      extension: POSTER_TYPES[detected],
    },
  };
}
