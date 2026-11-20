import { AdminSidebar } from "@/components/AdminSidebar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentProfile } from "@/lib/auth";
import { countPendingPayments } from "@/lib/paymentQueries";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

// Administrators get a sidebar layout; everyone else (staff, customers, guests)
// keeps the top header.
export async function AppFrame({ children }) {
  let isAdmin = false;

  if (getPublicSupabaseEnv().configured) {
    try {
      const { profile } = await getCurrentProfile();
      isAdmin = Boolean(profile?.is_active && profile.role === "administrator");
    } catch {
      isAdmin = false;
    }
  }

  if (isAdmin) {
    let pendingPayments = 0;
    try {
      pendingPayments = await countPendingPayments();
    } catch {
      pendingPayments = 0;
    }

    return (
      <div className="flex min-h-screen flex-col md:flex-row">
        <AdminSidebar pendingPayments={pendingPayments} />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
          <SiteFooter />
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </>
  );
}