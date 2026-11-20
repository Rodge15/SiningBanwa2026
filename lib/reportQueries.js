import { createAdminClient } from "@/lib/supabase/admin";

// Tickets on a reservation = general-admission count + active seated items.
function ticketsOf(row) {
  const seated = (row.reservation_items || []).filter((item) => !item.released_at).length;
  return (row.ticket_quantity || 0) + seated;
}

// Sales: revenue, bookings, and tickets from confirmed bookings, plus a
// per-event breakdown (highest revenue first).
export async function getSalesReport() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(
      "event_id, event_title, total_amount, ticket_quantity, created_at, reservation_items(released_at)",
    )
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  const rows = data || [];
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalTickets = rows.reduce((sum, row) => sum + ticketsOf(row), 0);

  const byEvent = new Map();
  for (const row of rows) {
    const key = row.event_id || row.event_title || "unknown";
    const current = byEvent.get(key) || { title: row.event_title || "Untitled", bookings: 0, tickets: 0, revenue: 0 };
    current.bookings += 1;
    current.tickets += ticketsOf(row);
    current.revenue += Number(row.total_amount || 0);
    byEvent.set(key, current);
  }

  const events = [...byEvent.values()].sort((a, b) => b.revenue - a.revenue);

  return { error, totalRevenue, totalBookings: rows.length, totalTickets, events };
}

// Reports: counts of reservations by status, payments by status, admitted count,
// and the top events by confirmed bookings.
export async function getReportsOverview() {
  const admin = createAdminClient();

  const [{ data: reservations }, { data: payments }] = await Promise.all([
    admin.from("reservations").select("status, admitted_at, event_title"),
    admin.from("payments").select("status"),
  ]);

  const statusCounts = {};
  const topMap = new Map();
  let admitted = 0;

  for (const row of reservations || []) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    if (row.admitted_at) {
      admitted += 1;
    }
    if (row.status === "confirmed") {
      topMap.set(row.event_title, (topMap.get(row.event_title) || 0) + 1);
    }
  }

  const paymentCounts = {};
  for (const row of payments || []) {
    paymentCounts[row.status] = (paymentCounts[row.status] || 0) + 1;
  }

  const topEvents = [...topMap.entries()]
    .map(([title, count]) => ({ title: title || "Untitled", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalReservations: (reservations || []).length,
    statusCounts,
    paymentCounts,
    admitted,
    topEvents,
  };
}

// Evaluation: per-event performance — fill rate (tickets vs capacity) and
// attendance rate (admitted vs confirmed bookings).
export async function getEvaluation() {
  const admin = createAdminClient();

  const [{ data: events }, { data: reservations }] = await Promise.all([
    admin.from("events").select("id, title, audience_capacity, status"),
    admin
      .from("reservations")
      .select("event_id, total_amount, ticket_quantity, admitted_at, reservation_items(released_at)")
      .eq("status", "confirmed"),
  ]);

  const byEvent = new Map();
  for (const row of reservations || []) {
    const current = byEvent.get(row.event_id) || { bookings: 0, tickets: 0, admitted: 0, revenue: 0 };
    current.bookings += 1;
    current.tickets += ticketsOf(row);
    current.revenue += Number(row.total_amount || 0);
    if (row.admitted_at) {
      current.admitted += 1;
    }
    byEvent.set(row.event_id, current);
  }

  const rows = (events || [])
    .map((event) => {
      const agg = byEvent.get(event.id) || { bookings: 0, tickets: 0, admitted: 0, revenue: 0 };
      const capacity = event.audience_capacity || 0;
      return {
        title: event.title,
        status: event.status,
        capacity,
        bookings: agg.bookings,
        tickets: agg.tickets,
        admitted: agg.admitted,
        revenue: agg.revenue,
        fillRate: capacity > 0 ? agg.tickets / capacity : null,
        attendanceRate: agg.bookings > 0 ? agg.admitted / agg.bookings : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return { rows };
}