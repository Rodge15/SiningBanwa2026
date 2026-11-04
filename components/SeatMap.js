"use client";

import { effectivePrice, effectiveTier, formatPeso, POSITION_MAX, seatStatusMeta, SEAT_STATUS_META, SEAT_TIER_META } from "@/lib/seatRules";

const BOX_WIDTH = 84;
const BOX_HEIGHT = 58;
const GAP = 8;
const ROW_LABEL_WIDTH = 36;

export function SeatLegend() {
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-3 text-xs text-muted">
        {Object.entries(SEAT_TIER_META).map(([tier, meta]) => (
          <li key={tier} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-3 text-xs text-muted">
        {Object.entries(SEAT_STATUS_META).map(([status, meta]) => (
          <li key={status} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border-2 bg-white" style={{ borderColor: meta.color }} />
            {meta.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function clampPosition(value) {
  return Math.max(0, Math.min(POSITION_MAX, Math.round(value)));
}

function canvasSize(sections) {
  let width = 720;
  let height = 420;

  for (const section of sections || []) {
    width = Math.max(width, Number(section.posX || 0) + 280);
    height = Math.max(height, Number(section.posY || 0) + 120);

    for (const row of section.rows || []) {
      width = Math.max(width, Number(row.posX || 0) + 180);
      height = Math.max(height, Number(row.posY || 0) + 70);

      for (const seat of row.seats || []) {
        width = Math.max(width, Number(seat.posX || 0) + 100);
        height = Math.max(height, Number(seat.posY || 0) + 70);
      }
    }
  }

  return { width: Math.min(width + 48, 4040), height: Math.min(height + 48, 4040) };
}

export function SeatMap({
  sections,
  interactive = false,
  selectedKey = "",
  selectedSeatIds = [],
  onBoxClick,
  onDrag,
  draggable = false,
  layout = "auto",
  selectAvailableOnly = false,
}) {
  const selectedIds = new Set(selectedSeatIds);
  const useCanvas = layout === "canvas" || (layout !== "grid" && (sections || []).some((section) => Number.isInteger(Number(section.posX))));

  if (!sections?.length) {
    return <p className="text-sm text-muted">No seating sections yet.</p>;
  }

  if (useCanvas) {
    const size = canvasSize(sections);

    function beginDrag(event, payload) {
      if (!draggable) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const originX = event.clientX;
      const originY = event.clientY;
      onDrag?.({ ...payload, dx: 0, dy: 0, phase: "start" });

      function move(pointerEvent) {
        onDrag?.({
          ...payload,
          dx: pointerEvent.clientX - originX,
          dy: pointerEvent.clientY - originY,
          phase: "move",
        });
      }

      function end(pointerEvent) {
        window.removeEventListener("pointermove", move);
        onDrag?.({
          ...payload,
          dx: pointerEvent.clientX - originX,
          dy: pointerEvent.clientY - originY,
          phase: "end",
        });
      }

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end, { once: true });
    }

    return (
      <div className="space-y-3">
        <SeatLegend />
        <div className="overflow-auto rounded-xl border border-line bg-white p-3">
          <svg role="group" aria-label="Seating layout" width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} className="max-w-none">
            {sections.map((section) => (
              <g key={section.id}>
                <g
                  role={draggable ? "button" : "img"}
                  tabIndex={draggable ? 0 : undefined}
                  aria-label={`${section.name} section`}
                  onPointerDown={draggable ? (event) => beginDrag(event, { kind: "section", id: section.id }) : undefined}
                  onClick={interactive ? () => onBoxClick?.({ sectionId: section.id, kind: "section" }) : undefined}
                >
                  <rect x={Number(section.posX) || 0} y={Number(section.posY) || 0} width="168" height="28" rx="6" fill="#fffdf9" stroke="#d7cdc6" />
                  <text x={(Number(section.posX) || 0) + 8} y={(Number(section.posY) || 0) + 18} fill="#1f1a17" fontSize="12">
                    {section.name}
                  </text>
                </g>
                {(section.rows || []).map((row) => {
                  const tier = SEAT_TIER_META[effectiveTier(row, section)] || SEAT_TIER_META.regular;

                  return (
                    <g key={row.id}>
                      <g
                        role={draggable ? "button" : "img"}
                        tabIndex={draggable ? 0 : undefined}
                        aria-label={`Row ${row.label}, ${tier.label}, ${formatPeso(row.price ?? section.defaultPrice)}`}
                        onPointerDown={draggable ? (event) => beginDrag(event, { kind: "row", id: row.id, sectionId: section.id }) : undefined}
                      >
                        <text x={Number(row.posX) || 0} y={(Number(row.posY) || 0) + 16} fill="#6b5e57" fontSize="12">
                          {row.label} {tier.label}
                        </text>
                      </g>
                      {(row.seats || []).map((seat) => {
                        const meta = seatStatusMeta(seat.status);
                        const selected = selectedKey === seat.id || selectedIds.has(seat.id);
                        const canClick = interactive && (!selectAvailableOnly || seat.status === "available");
                        const price = seat.livePrice == null ? null : Number(seat.livePrice);
                        const shownPrice = Number.isFinite(price) ? price : effectivePrice(seat, section, row);
                        const x = Number(seat.posX) || 0;
                        const y = Number(seat.posY) || 0;

                        return (
                          <g
                            key={seat.id}
                            role={canClick || draggable ? "button" : "img"}
                            tabIndex={canClick || draggable ? 0 : undefined}
                            aria-label={`Seat ${seat.label}, ${tier.label}, ${formatPeso(shownPrice)}, ${meta.label}`}
                            aria-pressed={canClick ? selected : undefined}
                            onPointerDown={draggable ? (event) => beginDrag(event, { kind: "seat", id: seat.id, sectionId: section.id, rowId: row.id }) : undefined}
                            onClick={canClick ? () => onBoxClick?.({ sectionId: section.id, rowId: row.id, colIndex: seat.colIndex, seat, kind: "seat" }) : undefined}
                            onKeyDown={
                              canClick
                                ? (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      onBoxClick?.({ sectionId: section.id, rowId: row.id, colIndex: seat.colIndex, seat, kind: "seat" });
                                    }
                                  }
                                : undefined
                            }
                          >
                            <rect
                              x={x}
                              y={y}
                              width="84"
                              height="44"
                              rx="6"
                              fill={tier.color}
                              fillOpacity={seat.status === "blocked" ? 0.45 : 1}
                              stroke={selected ? "#1f1a17" : meta.color}
                              strokeWidth={selected ? 3 : 2}
                            />
                            <text x={x + 8} y={y + 18} fill="#ffffff" fontSize="11">
                              {seat.label}
                            </text>
                            <text x={x + 8} y={y + 34} fill="#ffffff" fontSize="10">
                              {formatPeso(shownPrice)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const rows = [...section.rows].sort((a, b) => a.sortOrder - b.sortOrder);
        const width = ROW_LABEL_WIDTH + section.columnCount * (BOX_WIDTH + GAP);
        const height = rows.length * (BOX_HEIGHT + GAP);

        return (
          <figure key={section.id} className="space-y-3">
            <figcaption className="text-sm font-medium">
              {section.name}
              <span className="ml-2 font-normal text-muted">Default {formatPeso(section.defaultPrice)}</span>
            </figcaption>
            <div className="overflow-x-auto rounded-xl border border-line bg-white p-3">
              <svg
                role="group"
                aria-label={`${section.name} seating`}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="max-w-none"
              >
                {rows.map((row, rowNumber) => {
                  const y = rowNumber * (BOX_HEIGHT + GAP);
                  const seatsByColumn = new Map((row.seats || []).map((seat) => [seat.colIndex, seat]));

                  return (
                    <g key={row.id}>
                      <text x="0" y={y + 34} fill="#6b5e57" fontSize="12">
                        {row.label}
                      </text>
                      {Array.from({ length: section.columnCount }, (_, colIndex) => {
                        const seat = seatsByColumn.get(colIndex) || null;
                        const x = ROW_LABEL_WIDTH + colIndex * (BOX_WIDTH + GAP);
                        const key = `${section.id}:${row.id}:${colIndex}`;
                        const selected = key === selectedKey || Boolean(seat && selectedIds.has(seat.id));
                        const meta = seat ? seatStatusMeta(seat.status) : null;
                        const canClick = interactive && (!selectAvailableOnly || seat?.status === "available");
                        const price = seat?.livePrice == null ? null : Number(seat.livePrice);
                        const shownPrice = seat ? (Number.isFinite(price) ? price : effectivePrice(seat, section, row)) : null;
                        const tier = seat ? SEAT_TIER_META[effectiveTier(row, section)] || SEAT_TIER_META.regular : null;
                        const label = seat
                          ? `Seat ${seat.label}, ${formatPeso(shownPrice)}, ${meta.label}`
                          : `Empty box, row ${row.label}, column ${colIndex + 1}`;

                        return (
                          <g
                            key={key}
                            role={canClick ? "button" : "img"}
                            tabIndex={canClick ? 0 : undefined}
                            aria-label={label}
                            aria-pressed={canClick ? selected : undefined}
                            onClick={
                              canClick
                                ? () => onBoxClick?.({ sectionId: section.id, rowId: row.id, colIndex, seat })
                                : undefined
                            }
                            onKeyDown={
                              canClick
                                ? (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      onBoxClick?.({ sectionId: section.id, rowId: row.id, colIndex, seat });
                                    }
                                  }
                                : undefined
                            }
                            className={canClick ? "cursor-pointer" : undefined}
                          >
                            <title>{label}</title>
                            <rect
                              x={x}
                              y={y}
                              width={BOX_WIDTH}
                              height={BOX_HEIGHT}
                              rx="8"
                              fill={tier?.color || "#fffdf9"}
                              fillOpacity={seat?.status === "blocked" ? 0.45 : 1}
                              stroke={selected ? "#1f1a17" : meta?.color || "#d7cdc6"}
                              strokeWidth={selected ? 3 : 2}
                              strokeDasharray={seat ? undefined : "4 3"}
                            />
                            <text
                              x={x + BOX_WIDTH / 2}
                              y={y + (seat ? 24 : 34)}
                              textAnchor="middle"
                              fontSize="12"
                              fontWeight="600"
                              fill={meta?.text || "#6b5e57"}
                              pointerEvents="none"
                            >
                              {seat ? seat.label : "Empty"}
                            </text>
                            {seat ? (
                              <text
                                x={x + BOX_WIDTH / 2}
                                y={y + 42}
                                textAnchor="middle"
                                fontSize="10"
                                fill={meta.text}
                                pointerEvents="none"
                              >
                                {formatPeso(shownPrice)}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
          </figure>
        );
      })}
      <SeatLegend />
    </div>
  );
}
