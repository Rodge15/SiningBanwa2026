import { connection } from "next/server";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { getEvaluation } from "@/lib/reportQueries";
import { ADMIN_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";

export const metadata = {
  title: "Evaluation | Sining Banwa",
};

function percent(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function Bar({ value }) {
  const pct = value === null || value === undefined ? 0 : Math.min(100, Math.round(value * 100));
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </div>
  );
}

async function Evaluation() {
  await requireRole(ADMIN_ROLES);
  await connection();

  const { rows } = await getEvaluation();
  const withBookings = rows.filter((row) => row.bookings > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Evaluation</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          How each event performed. <span className="font-medium">Fill rate</span> is tickets sold vs
          capacity. <span className="font-medium">Attendance</span> is how many confirmed bookings
          actually showed up (admitted at the door).
        </p>
      </div>

      {withBookings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No confirmed bookings to evaluate yet.
        </p>
      ) : (
        <div className="space-y-4">
          {withBookings.map((row) => (
            <section key={row.title} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{row.title}</h2>
                <span className="text-sm text-muted">{formatPeso(row.revenue)}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Bookings</p>
                  <p className="text-xl font-semibold">{row.bookings}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Tickets / capacity</p>
                  <p className="text-xl font-semibold">
                    {row.tickets}
                    <span className="text-sm text-muted"> / {row.capacity || "—"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Fill rate</p>
                  <p className="text-xl font-semibold">{percent(row.fillRate)}</p>
                  <Bar value={row.fillRate} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">Attendance</p>
                  <p className="text-xl font-semibold">
                    {percent(row.attendanceRate)}
                    <span className="text-sm text-muted"> ({row.admitted}/{row.bookings})</span>
                  </p>
                  <Bar value={row.attendanceRate} />
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EvaluationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading evaluation...</p>}>
      <Evaluation />
    </Suspense>
  );
}