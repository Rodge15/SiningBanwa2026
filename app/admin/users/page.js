import Link from "next/link";
import { Suspense } from "react";
import { setProfileAccess } from "@/app/actions/admin";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { ADMIN_ROLES, ROLES, roleLabel } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Users | Sining Banwa",
};

async function UserList({ searchParams }) {
  const { user } = await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Administrator</p>
        <h1 className="mt-1 text-3xl font-semibold">Users</h1>
        <p className="mt-2 text-sm text-muted">
          Change a role or switch an account off. Inactive accounts cannot log in. You cannot change
          your own account here.
        </p>
        <Link href="/admin/customers/export" className={`${buttonClass} mt-4`}>
          Download customer contacts
        </Link>
      </div>
      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Users could not be loaded.
        </p>
      ) : null}
      <div className="space-y-3">
        {(data || []).map((profile) => (
          <form
            key={profile.id}
            action={setProfileAccess}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <input type="hidden" name="id" value={profile.id} />
            <div className="text-sm">
              <p className="font-medium">{profile.full_name || "(no name)"}</p>
              <p className="text-muted">{profile.email}</p>
            </div>
            {profile.id === user.id ? (
              <p className="text-sm text-muted">{roleLabel(profile.role)} (you)</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <select
                  name="role"
                  defaultValue={profile.role}
                  aria-label="Role"
                  className="rounded-lg border border-line bg-white px-2 py-2"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="isActive" defaultChecked={profile.is_active} />
                  Active
                </label>
                <button type="submit" className={buttonClass}>
                  Save
                </button>
              </div>
            )}
          </form>
        ))}
      </div>
    </section>
  );
}

export default function AdminUsersPage({ searchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Checking access...</p>}>
      <UserList searchParams={searchParams} />
    </Suspense>
  );
}
