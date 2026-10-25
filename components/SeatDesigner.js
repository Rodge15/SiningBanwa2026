"use client";

import { useState } from "react";
import { Alert } from "@/components/Alert";
import { SeatMap } from "@/components/SeatMap";
import { buttonClass, fieldClass } from "@/components/formStyles";
import {
  DESIGNER_STATUSES,
  effectivePrice,
  formatPeso,
  isProtectedStatus,
  nextRowLabel,
  seatLabelsInLayout,
  seatStatusMeta,
  uniqueSeatLabel,
  validateLayout,
  validateNewSection,
} from "@/lib/seatRules";

function newId() {
  return crypto.randomUUID();
}

function findSelection(sections, selected) {
  if (!selected) {
    return null;
  }

  const section = sections.find((item) => item.id === selected.sectionId);
  const row = section?.rows.find((item) => item.id === selected.rowId);
  const seat = row?.seats.find((item) => item.colIndex === selected.colIndex) || null;

  if (!section || !row) {
    return null;
  }

  return { section, row, seat };
}

function mapSeat(sections, selected, updater) {
  return sections.map((section) => {
    if (section.id !== selected.sectionId) {
      return section;
    }

    return {
      ...section,
      rows: section.rows.map((row) => {
        if (row.id !== selected.rowId) {
          return row;
        }

        return {
          ...row,
          seats: row.seats.map((seat) => (seat.colIndex === selected.colIndex ? updater(seat) : seat)),
        };
      }),
    };
  });
}

function savedProtectedIds(layout) {
  const ids = new Set();

  for (const section of layout?.sections || []) {
    for (const row of section.rows || []) {
      for (const seat of row.seats || []) {
        if (isProtectedStatus(seat.status)) {
          ids.add(seat.id);
        }
      }
    }
  }

  return ids;
}

export function SeatDesigner({ eventId, initialLayout, action }) {
  const lockedIds = savedProtectedIds(initialLayout);
  const [sections, setSections] = useState(initialLayout?.sections || []);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "Orchestra", price: "500", columns: "8", rows: "3" });
  const current = findSelection(sections, selected);
  const parsed = validateLayout({ sections });
  const layoutJson = JSON.stringify(parsed.ok ? parsed.value : { sections });

  function addSection(event) {
    event.preventDefault();
    const result = validateNewSection({
      name: draft.name,
      defaultPrice: draft.price,
      columnCount: Number(draft.columns),
      rowCount: Number(draft.rows),
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    if (sections.some((section) => section.name.toLowerCase() === result.value.name.toLowerCase())) {
      setError("Section names must be unique in the event.");
      return;
    }

    if (sections.length >= 12) {
      setError("A layout can have at most 12 sections.");
      return;
    }

    const labels = [];
    const builtRows = Array.from({ length: result.value.rowCount }, (_, index) => {
      const label = nextRowLabel(labels);
      labels.push(label);
      return { id: newId(), label, sortOrder: index, seats: [] };
    });

    setSections((currentSections) => [
      ...currentSections,
      {
        id: newId(),
        name: result.value.name,
        defaultPrice: result.value.defaultPrice,
        sortOrder: currentSections.length ? Math.max(...currentSections.map((section) => section.sortOrder)) + 1 : 0,
        columnCount: result.value.columnCount,
        rows: builtRows,
      },
    ]);
    setError("");
  }

  function updateSection(sectionId, updater) {
    setSections((currentSections) =>
      currentSections.map((section) => (section.id === sectionId ? updater(section) : section)),
    );
  }

  function removeSection(section) {
    if (section.rows.some((row) => row.seats.some((seat) => lockedIds.has(seat.id)))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    setSections((currentSections) => currentSections.filter((item) => item.id !== section.id));
    setSelected(null);
    setError("");
  }

  function addRow(section) {
    if (section.rows.length >= 40) {
      setError("Each section needs 1 to 40 rows.");
      return;
    }

    const label = nextRowLabel(section.rows.map((row) => row.label));

    if (!label) {
      setError("Each section needs 1 to 40 rows.");
      return;
    }

    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: [
        ...currentSection.rows,
        {
          id: newId(),
          label,
          sortOrder: currentSection.rows.length ? Math.max(...currentSection.rows.map((row) => row.sortOrder)) + 1 : 0,
          seats: [],
        },
      ],
    }));
    setError("");
  }

  function removeRow(section, row) {
    if (row.seats.some((seat) => lockedIds.has(seat.id))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    if (section.rows.length === 1) {
      setError("Each section needs 1 to 40 rows.");
      return;
    }

    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.filter((item) => item.id !== row.id),
    }));
    setSelected(null);
    setError("");
  }

  function renameRow(section, row, label) {
    if (row.seats.some((seat) => lockedIds.has(seat.id))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.map((item) => (item.id === row.id ? { ...item, label } : item)),
    }));
  }

  function changeColumns(section, raw, input) {
    const columnCount = Number(raw);

    if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > 40) {
      setError("Each section needs 1 to 40 columns.");
      if (input) {
        input.value = String(section.columnCount);
      }
      return;
    }

    if (section.rows.some((row) => row.seats.some((seat) => seat.colIndex >= columnCount && lockedIds.has(seat.id)))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      columnCount,
      rows: currentSection.rows.map((row) => ({
        ...row,
        seats: row.seats.filter((seat) => seat.colIndex < columnCount),
      })),
    }));
    setError("");
  }

  function handleBoxClick(box) {
    if (box.seat) {
      setSelected({ sectionId: box.sectionId, rowId: box.rowId, colIndex: box.colIndex });
      setError("");
      return;
    }

    const section = sections.find((item) => item.id === box.sectionId);
    const row = section?.rows.find((item) => item.id === box.rowId);

    if (!section || !row) {
      return;
    }

    const label = uniqueSeatLabel(seatLabelsInLayout(sections), `${row.label}${box.colIndex + 1}`);

    if (!label) {
      setError("Seat label must be 1 to 20 letters, numbers, or hyphens.");
      return;
    }

    const seat = {
      id: newId(),
      label,
      colIndex: box.colIndex,
      priceOverride: null,
      status: "available",
    };

    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.map((item) =>
        item.id === row.id ? { ...item, seats: [...item.seats, seat] } : item,
      ),
    }));
    setSelected({ sectionId: box.sectionId, rowId: box.rowId, colIndex: box.colIndex });
    setError("");
  }

  function updateSelectedSeat(patch) {
    if (!current?.seat || lockedIds.has(current.seat.id)) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    setSections((currentSections) => mapSeat(currentSections, selected, (seat) => ({ ...seat, ...patch })));
    setError("");
  }

  function removeSelectedSeat() {
    if (!current?.seat) {
      return;
    }

    if (lockedIds.has(current.seat.id)) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }

    setSections((currentSections) =>
      currentSections.map((section) => {
        if (section.id !== selected.sectionId) {
          return section;
        }

        return {
          ...section,
          rows: section.rows.map((row) =>
            row.id === selected.rowId
              ? { ...row, seats: row.seats.filter((seat) => seat.colIndex !== selected.colIndex) }
              : row,
          ),
        };
      }),
    );
    setSelected(null);
    setError("");
  }

  function layoutForSave() {
    const nextSections = [];

    for (const section of sections) {
      const input = document.getElementById(`columns-${section.id}`);
      const columnCount = input ? Number(input.value) : section.columnCount;

      if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > 40) {
        return { ok: false, message: "Each section needs 1 to 40 columns." };
      }

      if (section.rows.some((row) => row.seats.some((seat) => seat.colIndex >= columnCount && lockedIds.has(seat.id)))) {
        return { ok: false, message: "A reserved, sold, or on-hold seat cannot be removed or changed." };
      }

      nextSections.push({
        ...section,
        columnCount,
        rows: section.rows.map((row) => ({
          ...row,
          seats: row.seats.filter((seat) => seat.colIndex < columnCount),
        })),
      });
    }

    return validateLayout({ sections: nextSections });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addSection} className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="sectionName" className="text-sm font-medium">
            New section
          </label>
          <input
            id="sectionName"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="sectionPrice" className="text-sm font-medium">
            Default price (PHP)
          </label>
          <input
            id="sectionPrice"
            inputMode="decimal"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="sectionColumns" className="text-sm font-medium">
            Columns
          </label>
          <input
            id="sectionColumns"
            inputMode="numeric"
            value={draft.columns}
            onChange={(event) => setDraft({ ...draft, columns: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="sectionRows" className="text-sm font-medium">
            Rows
          </label>
          <input
            id="sectionRows"
            inputMode="numeric"
            value={draft.rows}
            onChange={(event) => setDraft({ ...draft, rows: event.target.value })}
            className={fieldClass}
          />
          <button type="submit" className={`${buttonClass} mt-3 w-full`}>
            Add section
          </button>
        </div>
      </form>

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => setPreview((value) => !value)}>
          {preview ? "Back to editing" : "Preview layout"}
        </button>
      </div>

      {preview ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">Customer preview</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            This is the saved-looking map customers will see. Holds open after you save and publish.
          </p>
          <SeatMap sections={parsed.ok ? parsed.value.sections : sections} />
        </div>
      ) : (
        <div className="space-y-6">
          {sections.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-sm text-muted">
              Add a section, then click an empty box to add a seat. Click a seat to rename it, change its price, or block it.
            </p>
          ) : null}
          {sections.map((section) => (
            <section key={section.id} className="space-y-4 rounded-2xl border border-line bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium" htmlFor={`name-${section.id}`}>
                    Section name
                  </label>
                  <input
                    id={`name-${section.id}`}
                    value={section.name}
                    onChange={(event) =>
                      updateSection(section.id, (currentSection) => ({ ...currentSection, name: event.target.value }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`price-${section.id}`}>
                    Default price (PHP)
                  </label>
                  <input
                    id={`price-${section.id}`}
                    inputMode="decimal"
                    value={section.defaultPrice}
                    onChange={(event) =>
                      updateSection(section.id, (currentSection) => ({
                        ...currentSection,
                        defaultPrice: event.target.value,
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`columns-${section.id}`}>
                    Columns
                  </label>
                  <input
                    id={`columns-${section.id}`}
                    inputMode="numeric"
                    defaultValue={section.columnCount}
                    key={`${section.id}-columns-${section.columnCount}`}
                    onBlur={(event) => changeColumns(section, event.target.value, event.target)}
                    className={fieldClass}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" className={buttonClass} onClick={() => addRow(section)}>
                    Add row
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-line px-4 py-2 text-sm"
                    onClick={() => removeSection(section)}
                  >
                    Remove section
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {[...section.rows]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((row) => {
                    const protectedRow = row.seats.some((seat) => lockedIds.has(seat.id));

                    return (
                      <div key={row.id} className="flex flex-wrap items-center gap-2">
                        <label className="text-sm text-muted" htmlFor={`row-${row.id}`}>
                          Row
                        </label>
                        <input
                          id={`row-${row.id}`}
                          value={row.label}
                          disabled={protectedRow}
                          onChange={(event) => renameRow(section, row, event.target.value)}
                          className="w-24 rounded-lg border border-line px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          className="text-sm text-brand hover:underline disabled:text-muted"
                          disabled={protectedRow}
                          onClick={() => removeRow(section, row)}
                        >
                          Remove row
                        </button>
                      </div>
                    );
                  })}
              </div>
              <SeatMap sections={[section]} interactive selectedKey={selected ? `${selected.sectionId}:${selected.rowId}:${selected.colIndex}` : ""} onBoxClick={handleBoxClick} />
            </section>
          ))}
        </div>
      )}

      {current?.seat && !preview ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">Selected seat {current.seat.label}</h2>
          {lockedIds.has(current.seat.id) ? (
            <p className="mt-2 text-sm text-muted">
              This seat is {seatStatusMeta(current.seat.status).label.toLowerCase()}. Its label, price, place, and status stay as saved.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Section price is {formatPeso(current.section.defaultPrice)}. Leave the seat price blank to use that price. Marking a seat reserved or sold protects it on the next save.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="seatLabel" className="text-sm font-medium">
                Label
              </label>
              <input
                id="seatLabel"
                value={current.seat.label}
                disabled={lockedIds.has(current.seat.id)}
                onChange={(event) => updateSelectedSeat({ label: event.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="seatPrice" className="text-sm font-medium">
                Seat price override (PHP)
              </label>
              <input
                id="seatPrice"
                inputMode="decimal"
                value={current.seat.priceOverride ?? ""}
                placeholder={String(effectivePrice(current.seat, current.section))}
                disabled={lockedIds.has(current.seat.id)}
                onChange={(event) => {
                  const raw = event.target.value.trim();

                  if (raw === "") {
                    updateSelectedSeat({ priceOverride: null });
                    return;
                  }

                  if (!/^\d+(\.\d{0,2})?$/.test(raw)) {
                    return;
                  }

                  updateSelectedSeat({ priceOverride: raw.endsWith(".") ? raw : Number(raw) });
                }}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="seatStatus" className="text-sm font-medium">
                Status
              </label>
              <select
                id="seatStatus"
                value={current.seat.status}
                disabled={lockedIds.has(current.seat.id)}
                onChange={(event) => updateSelectedSeat({ status: event.target.value })}
                className={fieldClass}
              >
                {DESIGNER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {seatStatusMeta(status).label}
                  </option>
                ))}
                {current.seat.status === "locked" ? <option value="locked">On hold</option> : null}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg border border-line px-4 py-2 text-sm"
            onClick={removeSelectedSeat}
          >
            Remove seat
          </button>
        </div>
      ) : null}

      <form
        action={action}
        onSubmit={(event) => {
          const result = layoutForSave();

          if (!result.ok) {
            event.preventDefault();
            setError(result.message);
            return;
          }

          event.currentTarget.elements.layout.value = JSON.stringify(result.value);
        }}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="layout" value={layoutJson} />
        <button type="submit" className={buttonClass}>
          Save layout
        </button>
      </form>
    </div>
  );
}
