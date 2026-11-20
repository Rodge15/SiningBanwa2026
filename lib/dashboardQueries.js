import { createAdminClient } from "@/lib/supabase/admin";

// Manager/admin dashboard stats. Uses the service-role client so totals cover
// every customer's data (row-level security would otherwise hide other users).
// Only ever called from a page already guarded by requireRole(EVENT_MANAGER_ROLES).
export async function getManagerDashboardStats() {
  let admin;

  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const [paymentsRes, reservationsRes, eventsRes, seatsRes] = await Promise.all([
    admin.from("payments").select("amount, status"),
    admin.from("reservations").select("status"),
    admin.from("events").select("status"),
    admin.from("event_seats").select("status"),
  ]);

  const payments = paymentsRes.error ? [] : paymentsRes.data || [];
  const reservations = reservationsRes.error ? [] : reservationsRes.data || [];
  const events = eventsRes.error ? [] : eventsRes.data || [];
  const seats = seatsRes.error ? [] : seatsRes.data || [];

  const revenue = payments
    .filter((payment) => payment.status === "verified")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingPayments = payments.filter((payment) => payment.status === "pending").length;

  const reservationStatus = reservations.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  const seatCount = (status) => seats.filter((seat) => seat.status === status).length;

  return {
    revenue,
    pendingPayments,
    totalBookings: reservations.length,
    reservationStatus,
    publishedEvents: events.filter((event) => event.status === "published").length,
    totalEvents: events.length,
    seats: {
      sold: seatCount("sold"),
      held: seatCount("reserved") + seatCount("locked"),
      available: seatCount("available"),
      blocked: seatCount("blocked"),
      total: seats.length,
    },
  };
}