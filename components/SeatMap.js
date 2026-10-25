"use client";

import { effectivePrice, formatPeso, seatStatusMeta, SEAT_STATUS_META } from "@/lib/seatRules";

const BOX_WIDTH = 84;
const BOX_HEIGHT = 58;
const GAP = 8;
const ROW_LABEL_WIDTH = 36;

export function SeatLegend() {
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted">
      {Object.entries(SEAT_STATUS_META).map(([status, meta]) => (
        <li key={status} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border border-black/10" style={{ backgroundColor: meta.color }} />
          {meta.label}
        </li>
      ))}
    </ul>
  );
}

export function SeatMap({
  sections,
  interactive = false,
  selectedKey = "",
  selectedSeatIds = [],
  onBoxClick,
  selectAvailableOnly = false,
}) {
  const selectedIds = new Set(selectedSeatIds);
  if (!sections?.length) {
    return <p className="text-sm text-muted">No seating sections yet.</p>;
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
                        const shownPrice = seat ? (Number.isFinite(price) ? price : effectivePrice(seat, section)) : null;
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
                              fill={meta?.color || "#fffdf9"}
                              stroke={selected ? "#7a2f2f" : "#e4d8cc"}
                              strokeWidth={selected ? 3 : 1.5}
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
