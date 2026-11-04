export const POSITION_MAX = 20000;

export const LAYOUT_LIMITS = {
  sections: 12,
  rows: 40,
  columns: 40,
  seats: 2000,
  name: 60,
  rowLabel: 8,
  seatLabel: 20,
  maxPrice: 999999.99,
  position: POSITION_MAX,
};

export const SEAT_STATUSES = ["available", "blocked", "reserved", "sold", "locked"];

export const SEAT_TIERS = ["regular", "semi_vip", "vip"];

export const SEAT_TIER_META = {
  regular: { label: "Regular", color: "#2f6f4e" },
  semi_vip: { label: "Semi-VIP", color: "#1d4e89" },
  vip: { label: "VIP", color: "#8a2f4a" },
};

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

export function effectiveTier(row, section) {
  return SEAT_TIERS.includes(row?.tier) ? row.tier : section?.tier || "regular";
}

export function effectivePrice(seat, section, row) {
  if (seat?.priceOverride !== null && seat?.priceOverride !== undefined && seat?.priceOverride !== "") {
    return Number(seat.priceOverride);
  }

  if (row?.price !== null && row?.price !== undefined && row?.price !== "") {
    return Number(row.price);
  }

  return Number(section.defaultPrice);
}

function cleanPosition(item, label) {
  const posX = Number(item?.posX);
  const posY = Number(item?.posY);

  if (
    !Number.isInteger(posX) ||
    !Number.isInteger(posY) ||
    posX < 0 ||
    posY < 0 ||
    posX > LAYOUT_LIMITS.position ||
    posY > LAYOUT_LIMITS.position
  ) {
    return fail(`${label} has an invalid saved position.`);
  }

  return { ok: true, posX, posY };
}

function cleanTier(value, label) {
  if (!SEAT_TIERS.includes(value)) {
    return fail(`${label} needs a Regular, Semi-VIP, or VIP tier.`);
  }

  return { ok: true, value };
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
    const tier = cleanTier(section?.tier, "Each section");
    const position = cleanPosition(section, "Each section");

    if (!price.ok) {
      return price;
    }

    if (!tier.ok) {
      return tier;
    }

    if (!position.ok) {
      return position;
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
      const rowTier = cleanTier(row?.tier, "Each row");
      const rowPrice = cleanPrice(row?.price, "Row price");
      const rowPosition = cleanPosition(row, "Each row");

      if (!rowTier.ok) {
        return rowTier;
      }

      if (!rowPrice.ok) {
        return rowPrice;
      }

      if (!rowPosition.ok) {
        return rowPosition;
      }

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
        const seatPosition = cleanPosition(seat, "Each seat");

        if (!seatPosition.ok) {
          return seatPosition;
        }

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
          posX: seatPosition.posX,
          posY: seatPosition.posY,
          priceOverride,
          status: seat.status,
        });
      }

      rows.push({
        id: row.id,
        label,
        tier: rowTier.value,
        price: rowPrice.value,
        sortOrder: rowSort,
        posX: rowPosition.posX,
        posY: rowPosition.posY,
        seats,
      });
    }

    sections.push({
      id: section.id,
      name,
      defaultPrice: price.value,
      tier: tier.value,
      sortOrder,
      columnCount,
      posX: position.posX,
      posY: position.posY,
      rows,
    });
  }

  return { ok: true, value: { sections } };
}

// Rebuilds the designer object from database rows. A save/reload test uses this
// so a saved layout can be compared without calling Supabase.
export function nestLayoutRows(sectionRows, rowRows, seatRows) {
  const sections = (sectionRows || []).map((section, sectionIndex) => ({
    id: section.id,
    name: section.name,
    defaultPrice: Number(section.default_price),
    tier: section.tier || "regular",
    sortOrder: section.sort_order,
    columnCount: section.column_count,
    posX: Number.isInteger(section.pos_x) ? section.pos_x : 40,
    posY: Number.isInteger(section.pos_y) ? section.pos_y : 40 + sectionIndex * 180,
    rows: (rowRows || [])
      .filter((row) => row.section_id === section.id)
      .map((row, rowIndex) => ({
        id: row.id,
        label: row.label,
        tier: row.tier || section.tier || "regular",
        price: Number(row.price ?? section.default_price),
        sortOrder: row.sort_order,
        posX: Number.isInteger(row.pos_x) ? row.pos_x : 56,
        posY: Number.isInteger(row.pos_y) ? row.pos_y : 88 + rowIndex * 72,
        seats: (seatRows || [])
          .filter((seat) => seat.row_id === row.id)
          .map((seat) => ({
            id: seat.id,
            label: seat.label,
            colIndex: seat.col_index,
            posX: Number.isInteger(seat.pos_x) ? seat.pos_x : 56 + seat.col_index * 92,
            posY: Number.isInteger(seat.pos_y) ? seat.pos_y : 116 + rowIndex * 72,
            priceOverride: seat.price_override === null || seat.price_override === undefined || seat.price_override === ""
              ? null
              : Number(seat.price_override),
            status: seat.status,
          })),
      })),
  }));

  return { sections };
}
