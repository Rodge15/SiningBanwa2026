"use client";

import { useRef, useState } from "react";
import { Alert } from "@/components/Alert";
import { SeatMap } from "@/components/SeatMap";
import { buttonClass, fieldClass } from "@/components/formStyles";
import {
  DESIGNER_STATUSES,
  SEAT_TIER_META,
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

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(4000, Math.round(number)));
}

function seatIsLocked(seat, lockedIds) {
  return lockedIds.has(seat.id) || isProtectedStatus(seat.status);
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

function withPositions(sections) {
  return (sections || []).map((section, sectionIndex) => ({
    ...section,
    tier: section.tier || "regular",
    posX: Number.isInteger(section.posX) ? section.posX : 40,
    posY: Number.isInteger(section.posY) ? section.posY : 40 + sectionIndex * 180,
    rows: (section.rows || []).map((row, rowIndex) => ({
      ...row,
      tier: row.tier || section.tier || "regular",
      price: row.price ?? section.defaultPrice,
      posX: Number.isInteger(row.posX) ? row.posX : 56,
      posY: Number.isInteger(row.posY) ? row.posY : 88 + rowIndex * 72,
      seats: (row.seats || []).map((seat) => ({
        ...seat,
        posX: Number.isInteger(seat.posX) ? seat.posX : 56 + Number(seat.colIndex || 0) * 92,
        posY: Number.isInteger(seat.posY) ? seat.posY : 116 + rowIndex * 72,
      })),
    })),
  }));
}

function shiftLayout(sections, payload, dx, dy, lockedIds) {
  return sections.map((section) => {
    if (payload.kind === "section" && section.id === payload.id) {
      if (section.rows.some((row) => row.seats.some((seat) => seatIsLocked(seat, lockedIds)))) {
        return section;
      }
      return {
        ...section,
        posX: clamp(section.posX + dx),
        posY: clamp(section.posY + dy),
        rows: section.rows.map((row) => ({
          ...row,
          posX: clamp(row.posX + dx),
          posY: clamp(row.posY + dy),
          seats: row.seats.map((seat) => ({ ...seat, posX: clamp(seat.posX + dx), posY: clamp(seat.posY + dy) })),
        })),
      };
    }

    return {
      ...section,
      rows: section.rows.map((row) => {
        if (payload.kind === "row" && row.id === payload.id) {
          if (row.seats.some((seat) => seatIsLocked(seat, lockedIds))) {
            return row;
          }
          return {
            ...row,
            posX: clamp(row.posX + dx),
            posY: clamp(row.posY + dy),
            seats: row.seats.map((seat) => ({ ...seat, posX: clamp(seat.posX + dx), posY: clamp(seat.posY + dy) })),
          };
        }
        return {
          ...row,
          seats: row.seats.map((seat) =>
            payload.kind === "seat" && seat.id === payload.id && !seatIsLocked(seat, lockedIds)
              ? { ...seat, posX: clamp(seat.posX + dx), posY: clamp(seat.posY + dy) }
              : seat,
          ),
        };
      }),
    };
  });
}

export function SeatDesigner({ eventId, initialLayout, action }) {
  const lockedIds = savedProtectedIds(initialLayout);
  const [sections, setSections] = useState(() => withPositions(initialLayout?.sections));
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ name: "Orchestra", price: "500", columns: "8", rows: "3" });
  const dragBase = useRef(null);
  const parsed = validateLayout({ sections });
  const layoutJson = JSON.stringify(parsed.ok ? parsed.value : { sections });
  const currentSection = sections.find((section) => section.id === selected?.sectionId) || null;
  const currentRow = currentSection?.rows.find((row) => row.id === selected?.rowId) || null;
  const currentSeat = currentRow?.seats.find((seat) => seat.id === selected?.seatId) || null;

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
    const labels = [];
    const usedSeatLabels = seatLabelsInLayout(sections);
    const sectionPosY = 40 + sections.length * 180;
    const builtRows = Array.from({ length: result.value.rowCount }, (_, index) => {
      const label = nextRowLabel(labels);
      labels.push(label);
      return {
        id: newId(),
        label,
        tier: "regular",
        price: result.value.defaultPrice,
        sortOrder: index,
        posX: 56,
        posY: sectionPosY + 40 + index * 72,
        seats: Array.from({ length: result.value.columnCount }, (_, colIndex) => {
          const seatLabel = uniqueSeatLabel(usedSeatLabels, `${label}${colIndex + 1}`);
          if (!seatLabel) {
            return null;
          }
          usedSeatLabels.push(seatLabel);
          return {
            id: newId(),
            label: seatLabel,
            colIndex,
            posX: 56 + colIndex * 92,
            posY: sectionPosY + 68 + index * 72,
            priceOverride: null,
            status: "available",
          };
        }).filter(Boolean),
      };
    });
    setSections((currentSections) => [
      ...currentSections,
      {
        id: newId(),
        name: result.value.name,
        defaultPrice: result.value.defaultPrice,
        tier: "regular",
        sortOrder: currentSections.length,
        columnCount: result.value.columnCount,
        posX: 40,
        posY: sectionPosY,
        rows: builtRows,
      },
    ]);
    setError("");
  }

  function updateSection(sectionId, updater) {
    setSections((currentSections) => currentSections.map((section) => (section.id === sectionId ? updater(section) : section)));
  }

  function removeSection(section) {
    if (section.rows.some((row) => row.seats.some((seat) => lockedIds.has(seat.id)))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }
    setSections((currentSections) => currentSections.filter((item) => item.id !== section.id));
    setSelected(null);
  }

  function addRow(section) {
    const label = nextRowLabel(section.rows.map((row) => row.label));
    if (!label || section.rows.length >= 40) {
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
          tier: currentSection.tier || "regular",
          price: Number(currentSection.defaultPrice) || 0,
          sortOrder: currentSection.rows.length,
          posX: Number(currentSection.posX || 40) + 16,
          posY: Number(currentSection.posY || 40) + 40 + currentSection.rows.length * 72,
          seats: [],
        },
      ],
    }));
  }

  function addSeat(section, row) {
    if (row.seats.length >= section.columnCount) {
      setError("That row is full. Raise the column count or remove an empty place first.");
      return;
    }
    const used = new Set(row.seats.map((seat) => seat.colIndex));
    const colIndex = Array.from({ length: section.columnCount }, (_, index) => index).find((index) => !used.has(index));
    const label = uniqueSeatLabel(seatLabelsInLayout(sections), `${row.label}${colIndex + 1}`);
    if (colIndex == null || !label) {
      setError("A unique seat label could not be made.");
      return;
    }
    const seat = {
      id: newId(),
      label,
      colIndex,
      posX: Number(row.posX || 0) + colIndex * 92,
      posY: Number(row.posY || 0) + 28,
      priceOverride: null,
      status: "available",
    };
    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.map((item) => (item.id === row.id ? { ...item, seats: [...item.seats, seat] } : item)),
    }));
    setSelected({ sectionId: section.id, rowId: row.id, seatId: seat.id });
    setError("");
  }

  function removeRow(section, row) {
    if (row.seats.some((seat) => lockedIds.has(seat.id))) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }
    if (section.rows.length <= 1) {
      setError("Each section needs at least one row.");
      return;
    }
    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.filter((item) => item.id !== row.id),
    }));
    setSelected(null);
    setError("");
  }

  function removeSeat(section, row, seat) {
    if (lockedIds.has(seat.id)) {
      setError("A reserved, sold, or on-hold seat cannot be removed or changed.");
      return;
    }
    updateSection(section.id, (currentSection) => ({
      ...currentSection,
      rows: currentSection.rows.map((item) =>
        item.id === row.id ? { ...item, seats: item.seats.filter((entry) => entry.id !== seat.id) } : item,
      ),
    }));
    setSelected(null);
    setError("");
  }

  function onDrag(payload) {
    if (payload.phase === "start") {
      dragBase.current = sections;
      return;
    }
    if (!dragBase.current) {
      return;
    }
    const next = shiftLayout(dragBase.current, payload, payload.dx, payload.dy, lockedIds);
    const moved = JSON.stringify(next) !== JSON.stringify(dragBase.current);
    if (!moved && payload.phase === "end" && (payload.dx !== 0 || payload.dy !== 0)) {
      setError("A reserved, sold, or on-hold seat cannot be moved.");
      return;
    }
    setSections(next);
    if (payload.phase === "end") {
      dragBase.current = null;
    }
  }

  function onBoxClick(box) {
    if (box.kind === "section") {
      setSelected({ sectionId: box.sectionId });
      return;
    }
    if (box.seat) {
      setSelected({ sectionId: box.sectionId, rowId: box.rowId, seatId: box.seat.id, colIndex: box.colIndex });
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addSection} className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="sectionName" className="text-sm font-medium">New section</label>
          <input id="sectionName" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sectionPrice" className="text-sm font-medium">Default price (PHP)</label>
          <input id="sectionPrice" inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sectionColumns" className="text-sm font-medium">Columns</label>
          <input id="sectionColumns" inputMode="numeric" value={draft.columns} onChange={(event) => setDraft({ ...draft, columns: event.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="sectionRows" className="text-sm font-medium">Rows</label>
          <input id="sectionRows" inputMode="numeric" value={draft.rows} onChange={(event) => setDraft({ ...draft, rows: event.target.value })} className={fieldClass} />
          <button type="submit" className={`${buttonClass} mt-3 w-full`}>Add section</button>
        </div>
      </form>
      {error ? <Alert>{error}</Alert> : null}
      <button type="button" className={buttonClass} onClick={() => setPreview((value) => !value)}>
        {preview ? "Back to editing" : "Preview layout"}
      </button>
      {preview ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-lg font-semibold">Customer preview</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Customers see these same tier colors and saved positions.</p>
          <SeatMap sections={parsed.ok ? parsed.value.sections : sections} layout="canvas" />
        </div>
      ) : (
        <div className="space-y-6">
          <SeatMap sections={sections} layout="canvas" draggable interactive selectedKey={currentSeat?.id || ""} onDrag={onDrag} onBoxClick={onBoxClick} />
          <p className="text-sm text-muted">Drag a section title, row label, or seat. Booked or sold seats stay where they were saved.</p>
          {sections.map((section) => (
            <section key={section.id} className="space-y-4 rounded-2xl border border-line bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium" htmlFor={`name-${section.id}`}>Section name</label>
                  <input id={`name-${section.id}`} value={section.name} onChange={(event) => updateSection(section.id, (item) => ({ ...item, name: event.target.value }))} className={fieldClass} />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`tier-${section.id}`}>Section tier</label>
                  <select id={`tier-${section.id}`} value={section.tier || "regular"} onChange={(event) => updateSection(section.id, (item) => ({ ...item, tier: event.target.value }))} className={fieldClass}>
                    {Object.entries(SEAT_TIER_META).map(([tier, meta]) => <option key={tier} value={tier}>{meta.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`price-${section.id}`}>Section price (PHP)</label>
                  <input id={`price-${section.id}`} inputMode="decimal" value={section.defaultPrice} onChange={(event) => updateSection(section.id, (item) => ({ ...item, defaultPrice: event.target.value }))} className={fieldClass} />
                </div>
                <div>
                  <label className="text-sm font-medium" htmlFor={`columns-${section.id}`}>Columns</label>
                  <input id={`columns-${section.id}`} inputMode="numeric" value={section.columnCount} onChange={(event) => {
                    const columnCount = Number(event.target.value);
                    if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > 40) {
                      return;
                    }
                    const highest = Math.max(0, ...section.rows.flatMap((row) => row.seats.map((seat) => seat.colIndex + 1)));
                    if (columnCount < highest) {
                      setError("Remove seats past that column before lowering the column count.");
                      return;
                    }
                    updateSection(section.id, (item) => ({ ...item, columnCount }));
                  }} className={fieldClass} />
                </div>
              </div>
              {section.rows.map((row) => {
                const protectedRow = row.seats.some((seat) => lockedIds.has(seat.id));
                return (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <input aria-label={`Row ${row.label}`} value={row.label} disabled={protectedRow} onChange={(event) => updateSection(section.id, (item) => ({ ...item, rows: item.rows.map((entry) => entry.id === row.id ? { ...entry, label: event.target.value } : entry) }))} className="w-20 rounded-lg border border-line px-2 py-1 text-sm" />
                    <select aria-label={`Tier for row ${row.label}`} value={row.tier || "regular"} disabled={protectedRow} onChange={(event) => updateSection(section.id, (item) => ({ ...item, rows: item.rows.map((entry) => entry.id === row.id ? { ...entry, tier: event.target.value } : entry) }))} className="rounded-lg border border-line px-2 py-1 text-sm">
                      {Object.entries(SEAT_TIER_META).map(([tier, meta]) => <option key={tier} value={tier}>{meta.label}</option>)}
                    </select>
                    <input aria-label={`Price for row ${row.label}`} inputMode="decimal" value={row.price ?? ""} disabled={protectedRow} onChange={(event) => updateSection(section.id, (item) => ({ ...item, rows: item.rows.map((entry) => entry.id === row.id ? { ...entry, price: event.target.value } : entry) }))} className="w-24 rounded-lg border border-line px-2 py-1 text-sm" />
                    <button type="button" className="text-sm text-brand hover:underline" onClick={() => addSeat(section, row)}>Add seat</button>
                    <button type="button" className="text-sm text-muted hover:underline" disabled={protectedRow} onClick={() => removeRow(section, row)}>Remove row</button>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => addRow(section)}>Add row</button>
                <button type="button" className="rounded-lg border border-line px-4 py-2 text-sm" onClick={() => removeSection(section)}>Remove section</button>
              </div>
            </section>
          ))}
          {currentSeat ? (
            <div className="rounded-2xl border border-line bg-card p-4">
              <h2 className="text-lg font-semibold">Selected seat {currentSeat.label}</h2>
              <p className="mt-2 text-sm text-muted">Row price is {formatPeso(effectivePrice(currentSeat, currentSection, currentRow))}. A blank override uses the row price.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <input aria-label="Seat label" value={currentSeat.label} disabled={lockedIds.has(currentSeat.id)} onChange={(event) => updateSection(currentSection.id, (item) => ({ ...item, rows: item.rows.map((row) => row.id === currentRow.id ? { ...row, seats: row.seats.map((seat) => seat.id === currentSeat.id ? { ...seat, label: event.target.value } : seat) } : row) }))} className={fieldClass} />
                <input aria-label="Seat price override" inputMode="decimal" value={currentSeat.priceOverride ?? ""} disabled={lockedIds.has(currentSeat.id)} onChange={(event) => updateSection(currentSection.id, (item) => ({ ...item, rows: item.rows.map((row) => row.id === currentRow.id ? { ...row, seats: row.seats.map((seat) => seat.id === currentSeat.id ? { ...seat, priceOverride: event.target.value === "" ? null : Number(event.target.value) } : seat) } : row) }))} className={fieldClass} />
                <select aria-label="Seat status" value={currentSeat.status} disabled={lockedIds.has(currentSeat.id)} onChange={(event) => updateSection(currentSection.id, (item) => ({ ...item, rows: item.rows.map((row) => row.id === currentRow.id ? { ...row, seats: row.seats.map((seat) => seat.id === currentSeat.id ? { ...seat, status: event.target.value } : seat) } : row) }))} className={fieldClass}>
                  {DESIGNER_STATUSES.map((status) => <option key={status} value={status}>{seatStatusMeta(status).label}</option>)}
                  {currentSeat.status === "locked" ? <option value="locked">On hold</option> : null}
                </select>
              </div>
              {lockedIds.has(currentSeat.id) ? null : (
                <button type="button" className="mt-3 text-sm text-muted hover:underline" onClick={() => removeSeat(currentSection, currentRow, currentSeat)}>
                  Remove this seat
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}
      <form action={action} onSubmit={(event) => {
        const result = validateLayout({ sections });
        if (!result.ok) {
          event.preventDefault();
          setError(result.message);
          return;
        }
        event.currentTarget.elements.layout.value = JSON.stringify(result.value);
      }}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="layout" value={layoutJson} />
        <button type="submit" className={buttonClass}>Save layout</button>
      </form>
    </div>
  );
}
