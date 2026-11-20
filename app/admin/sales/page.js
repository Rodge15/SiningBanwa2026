import { connection } from "next/server";
import { Suspense } from "react";
import { DonutChart } from "@/components/DonutChart";
import { requireRole } from "@/lib/auth";
import { getSalesReport } from "@/lib/reportQueries";
import { ADMIN_ROLES } from "@/lib/roles";
import { formatPeso } from "@/lib/seatRules";

export const metadata = {
  title: "Sales | Sining Banwa",
};

// The dragonfly wing colors from the logo.
const COLORS = ["#2fb3b0", "#8cc152", "#e0953a", "#d94a4a", "#8a8fd8", "#0d9488", "#6bbf59", "#c97f3a"];

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

async function SalesReport() {
  await requireRole(ADMIN_ROLES);
  await connection();

  const report = await getSalesReport();
  const chartData = report.events
    .slice(0, 8)
    .map((event, index) => ({ label: event.title, value: event.revenue, color: COLORS[index % COLORS.length] }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold">Sales</h1>
        <p className="mt-2 text-sm text-muted">Revenue from confirmed (paid and verified) bookings.</p>
      </div>

      {report.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Sales could not be loaded.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total revenue" value={formatPeso(report.totalRevenue)} />
        <StatCard label="Bookings" value={report.totalBookings} />
        <StatCard label="Tickets sold" value={report.totalTickets} />
      </div>

      {chartData.length > 0 ? (
        <section className="rounded-2xl border border-line bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Revenue by event</h2>
          <DonutChart data={chartData} />
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-background/40 text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Tickets</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted">
                  No confirmed sales yet.
                </td>
              </tr>
            ) : (
              report.events.map((event) => (
                <tr key={event.title} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{event.title}</td>
                  <td className="px-4 py-3">{event.bookings}</td>
                  <td className="px-4 py-3">{event.tickets}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatPeso(event.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading sales...</p>}>
      <SalesReport />
    </Suspense>
  );
}