// Dependency-free SVG donut chart. data: [{ label, value, color }].

// Pure helper: turn slices into stroke segments with cumulative offsets.
function buildSegments(slices, total, circumference) {
  let offset = 0;
  return slices.map((item) => {
    const dash = (Number(item.value) / total) * circumference;
    const segment = { label: item.label, color: item.color, dash, gap: circumference - dash, offset };
    offset += dash;
    return segment;
  });
}

export function DonutChart({ data, size = 176, thickness = 26 }) {
  const slices = (data || []).filter((item) => Number(item.value) > 0);
  const total = slices.reduce((sum, item) => sum + Number(item.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const segments = total > 0 ? buildSegments(slices, total, circumference) : [];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Reservations by status">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#ece6e1" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${segment.dash} ${segment.gap}`}
              strokeDashoffset={-segment.offset}
            />
          ))}
        </g>
        <text x={center} y={center - 6} textAnchor="middle" fontSize="26" fontWeight="600" fill="#1f2937">
          {total}
        </text>
        <text x={center} y={center + 16} textAnchor="middle" fontSize="12" fill="#6b5e57">
          total
        </text>
      </svg>

      {slices.length === 0 ? (
        <p className="text-sm text-muted">No reservations yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {slices.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="font-medium">{item.label}</span>
              <span className="text-muted">({item.value})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}