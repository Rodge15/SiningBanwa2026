export const LAYOUT_LIMITS = {
  sections: 12,
  rows: 40,
  columns: 40,
  seats: 2000,
  name: 60,
  rowLabel: 8,
  seatLabel: 20,
  maxPrice: 999999.99,
};

export const SEAT_STATUSES = ["available", "blocked", "reserved", "sold", "locked"];

export const DESIGNER_STATUSES = ["available", "blocked", "reserved", "sold"];

export const PROTECTED_STATUSES = ["reserved", "sold", "locked"];

export const SEAT_STATUS_META = {
  available: { label: "Available", color: "#2f6f4e", text: "#ffffff" },
  reserved: { label: "Awaiting payment", color: "#b8860b", text: "#1f1a17" },
  sold: { label: "Paid", color: "#1d4e89", text: "#ffffff" },
  locked: { label: "On hold", color: "#7a4e9a", text: "#ffffff" },
  blocked: { label: "Blocked", color: "#8a817c", text: "#ffffff" },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROW_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,7}$/;
const SEAT_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,19}$/;

function fail(message) {
  return { ok: false, message };
}

export function isProtectedStatus(status) {
  return PROTECTED_STATUSES.includes(status);
}

export function seatStatusMeta(status) {
  return SEAT_STATUS_META[status] || SEAT_STATUS_META.available;
}

export function formatPeso(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function effectivePrice(seat, section) {
  if (seat?.priceOverride === null || seat?.priceOverride === undefined || seat?.priceOverride === "") {
    return Number(section.defaultPrice);
  }

  return Number(seat.priceOverride);
}

export function rowLabelFromIndex(index) {
  let n = index;
  let label = "";

  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);

  return label;
}

export function nextRowLabel(existingLabels) {
  const used = new Set((existingLabels || []).map((label) => String(label).toLowerCase()));

  for (let index = 0; index < LAYOUT_LIMITS.rows; index += 1) {
    const label = rowLabelFromIndex(index);

    if (!used.has(label.toLowerCase())) {
      return label;
    }
  }

  return null;
}

export function uniqueSeatLabel(existingLabels, preferred) {
  const used = new Set((existingLabels || []).map((label) => String(label).toLowerCase()));
  const base = String(preferred || "S1");

  if (!used.has(base.toLowerCase()) && SEAT_LABEL_PATTERN.test(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const label = `${base}-${suffix}`;

    if (label.length <= LAYOUT_LIMITS.seatLabel && !used.has(label.toLowerCase())) {
      return label;
    }
  }

  return null;
}

export function seatLabelsInLayout(sections) {
  return (sections || []).flatMap((section) =>
    (section.rows || []).flatMap((row) => (row.seats || []).map((seat) => seat.label)),
  );
}

function cleanPrice(value, label) {
  if (typeof value === "string" && value.trim() === "") {
    return fail(`${label} is required.`);
  }

  const price = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(price) || price < 0 || price > LAYOUT_LIMITS.maxPrice) {
    return fail(`${label} must be from 0 to 999999.99.`);
  }

  const rounded = Math.round(price * 100) / 100;

  if (Math.abs(price - rounded) > 0.001) {
    return fail(`${label} can have at most 2 decimal places.`);
  }

  return { ok: true, value: rounded };
}

function cleanName(value) {
  const name = String(value || "").trim();

  if (name.length < 2 || name.length > LAYOUT_LIMITS.name || /[\u0000-\u001F\u007F]/.test(name) || name.startsWith("_")) {
    return null;
  }

  return name;
}

export function validateNewSection(input) {
  const name = cleanName(input?.name);
  const price = cleanPrice(input?.defaultPrice, "Section price");
  const columnCount = Number(input?.columnCount);
  const rowCount = Number(input?.rowCount);

  if (!name) {
    return fail("Section name must be 2 to 60 characters.");
  }

  if (!price.ok) {
    return price;
  }

  if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > LAYOUT_LIMITS.columns) {
    return fail("Each section needs 1 to 40 columns.");
  }

  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > LAYOUT_LIMITS.rows) {
    return fail("Each section needs 1 to 40 rows.");
  }

  return { ok: true, value: { name, defaultPrice: price.value, columnCount, rowCount } };
}

export function validateLayout(layout) {
  const source = layout?.sections;

  if (!Array.isArray(source)) {
    return fail("Seat layout must include a sections list.");
  }

  if (source.length > LAYOUT_LIMITS.sections) {
    return fail("A layout can have at most 12 sections.");
  }

  const sectionIds = new Set();
  const sectionNames = new Set();
  const rowIds = new Set();
  const seatIds = new Set();
  const seatLabels = new Set();
  const sections = [];
  let seatCount = 0;

  for (const section of source) {
    if (!UUID_PATTERN.test(String(section?.id || ""))) {
      return fail("Each section needs a valid id.");
    }

    const sectionId = String(section.id).toLowerCase();

    if (sectionIds.has(sectionId)) {
      return fail("Each section id must be unique.");
    }

    const name = cleanName(section?.name);

    if (!name) {
      return fail("Section name must be 2 to 60 characters.");
    }

    if (sectionNames.has(name.toLowerCase())) {
      return fail("Section names must be unique in the event.");
    }

    const price = cleanPrice(section?.defaultPrice, "Section price");

    if (!price.ok) {
      return price;
    }

    const columnCount = Number(section?.columnCount);
    const sortOrder = Number(section?.sortOrder);

    if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > LAYOUT_LIMITS.columns) {
      return fail("Each section needs 1 to 40 columns.");
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return fail("Section position must be a whole number.");
    }

    if (!Array.isArray(section.rows) || section.rows.length < 1 || section.rows.length > LAYOUT_LIMITS.rows) {
      return fail("Each section needs 1 to 40 rows.");
    }

    sectionIds.add(sectionId);
    sectionNames.add(name.toLowerCase());

    const rowLabels = new Set();
    const rowPositions = new Set();
    const rows = [];

    for (const row of section.rows) {
      if (!UUID_PATTERN.test(String(row?.id || ""))) {
        return fail("Each row needs a valid id.");
      }

      const rowId = String(row.id).toLowerCase();

      if (rowIds.has(rowId)) {
        return fail("Each row id must be unique.");
      }

      const label = String(row?.label || "").trim();

      if (!ROW_LABEL_PATTERN.test(label) || label.startsWith("_")) {
        return fail("Row label must be 1 to 8 letters, numbers, or hyphens.");
      }

      if (rowLabels.has(label.toLowerCase())) {
        return fail("Row labels must be unique inside a section.");
      }

      const rowSort = Number(row?.sortOrder);

      if (!Number.isInteger(rowSort) || rowSort < 0 || rowPositions.has(rowSort)) {
        return fail("Two rows cannot share the same position.");
      }

      if (!Array.isArray(row.seats)) {
        return fail("Each row needs a seats list.");
      }

      rowIds.add(rowId);
      rowLabels.add(label.toLowerCase());
      rowPositions.add(rowSort);

      const usedColumns = new Set();
      const seats = [];

      for (const seat of row.seats) {
        seatCount += 1;

        if (seatCount > LAYOUT_LIMITS.seats) {
          return fail("A layout can have at most 2000 seats.");
        }

        if (!UUID_PATTERN.test(String(seat?.id || ""))) {
          return fail("Each seat needs a valid id.");
        }

        const seatId = String(seat.id).toLowerCase();

        if (seatIds.has(seatId)) {
          return fail("Each seat id must be unique.");
        }

        const seatLabel = String(seat?.label || "").trim();

        if (!SEAT_LABEL_PATTERN.test(seatLabel) || seatLabel.startsWith("_")) {
          return fail("Seat label must be 1 to 20 letters, numbers, or hyphens.");
        }

        if (seatLabels.has(seatLabel.toLowerCase())) {
          return fail("Each seat label must be unique in the event.");
        }

        const colIndex = Number(seat?.colIndex);

        if (!Number.isInteger(colIndex) || colIndex < 0 || colIndex >= columnCount || usedColumns.has(colIndex)) {
          return fail("A seat is outside its row.");
        }

        if (!SEAT_STATUSES.includes(seat?.status)) {
          return fail("Unknown seat status.");
        }

        let priceOverride = null;

        if (seat.priceOverride !== null && seat.priceOverride !== undefined && seat.priceOverride !== "") {
          const override = cleanPrice(seat.priceOverride, "Seat price");

          if (!override.ok) {
            return override;
          }

          priceOverride = override.value;
        }

        seatIds.add(seatId);
        seatLabels.add(seatLabel.toLowerCase());
        usedColumns.add(colIndex);
        seats.push({
          id: seat.id,
          label: seatLabel,
          colIndex,
          priceOverride,
          status: seat.status,
        });
      }

      rows.push({
        id: row.id,
        label,
        sortOrder: rowSort,
        seats,
      });
    }

    sections.push({
      id: section.id,
      name,
      defaultPrice: price.value,
      sortOrder,
      columnCount,
      rows,
    });
  }

  return { ok: true, value: { sections } };
}
