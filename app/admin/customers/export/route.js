import { requireRole } from "@/lib/auth";
import { customerContactsToCsv } from "@/lib/csv";
import { ADMIN_ROLES } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireRole(ADMIN_ROLES);

  const supabase = await createClient();
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("role", "customer")
      .order("email", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      return new Response("Customer contacts could not be exported.", { status: 500 });
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return new Response(customerContactsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sining-banwa-customers.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
