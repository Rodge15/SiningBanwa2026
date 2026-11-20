import Link from "next/link";
import { Suspense } from "react";
import { setProfileAccess } from "@/app/actions/admin";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { ADMIN_ROLES, ROLES, roleLabel } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Users | Sining Banwa",
};

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
];

const ROLE_TONES = {
  administrator: "border-red-200 bg-red-50 text-red-700",
  staff: "border-blue-200 bg-blue-50 text-blue-700",
  venue: "border-amber-200 bg-amber-50 text-amber-800",
  customer: "border-stone-200 bg-stone-100 text-stone-700",
};

function firstString(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function formatJoined(value) {
  if (!value) {
    return "—";
  }

  try {
    return new Date(value).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function StatChip({ label, value, tone = "" }) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        ROLE_TONES[role] || ROLE_TONES.customer
      }`}
    >
      {roleLabel(role)}
    </span>
  );
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
      Inactive
    </span>
  );
}

async function UserList({ searchParams }) {
  const { user } = await requireRole(ADMIN_ROLES);
  const query = await searchParams;

  const q = firstString(query.q).trim();
  const roleFilter = ROLES.includes(firstString(query.role)) ? firstString(query.role) : "";
  const statusFilter = ["active", "inactive"].includes(firstString(query.status))
    ? firstString(query.status)
    : "";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const all = data || [];
  const total = all.length;
  const activeCount = all.filter((p) => p.is_active).length;
  const inactiveCount = total - activeCount;

  const needle = q.toLowerCase();
  const rows = all.filter((p) => {
    if (roleFilter && p.role !== roleFilter) {
      return false;
    }
    if (statusFilter === "active" && !p.is_active) {
      return false;
    }
    if (statusFilter === "inactive" && p.is_active) {
      return false;
    }
    if (needle) {
      const haystack = `${p.full_name || ""} ${p.email || ""}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  });

  const hasFilters = Boolean(q || roleFilter || statusFilter);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand">Administrator</p>
          <h1 className="mt-1 text-3xl font-semibold">Users</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Change a role or switch an account off. Inactive accounts cannot log in. You cannot change
            your own account here.
          </p>
        </div>
        <Link href="/admin/customers/export" className={buttonClass}>
          Download customer contacts
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatChip label="Total users" value={total} />
        <StatChip label="Active" value={activeCount} tone="text-emerald-600" />
        <StatChip label="Inactive" value={inactiveCount} tone="text-stone-500" />
      </div>

      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          Users could not be loaded.
        </p>
      ) : null}

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex-1 text-sm">
          <span className="text-muted">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted">Role</span>
          <select name="role" defaultValue={roleFilter} className={fieldClass}>
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-muted">Status</span>
          <select name="status" defaultValue={statusFilter} className={fieldClass}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass}>
            Apply
          </button>
          {hasFilters ? (
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 font-medium hover:border-brand"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <div>
        <p className="mb-2 text-sm text-muted">
          Showing <span className="font-semibold text-foreground">{rows.length}</span> of {total}{" "}
          {total === 1 ? "account" : "accounts"}
          {hasFilters ? " (filtered)" : ""}.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-background/40 text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    No accounts match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((profile) => {
                  const isSelf = profile.id === user.id;
                  const formId = `access-${profile.id}`;

                  return (
                    <tr key={profile.id} className="border-b border-line last:border-0 align-middle">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {profile.full_name || "(no name)"}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full border border-brand/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                              You
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted">{profile.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <RoleBadge role={profile.role} />
                        ) : (
                          <select
                            name="role"
                            form={formId}
                            defaultValue={profile.role}
                            aria-label={`Role for ${profile.email}`}
                            className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm outline-none focus:border-brand"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <StatusBadge active={profile.is_active} />
                        ) : (
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="isActive"
                              form={formId}
                              defaultChecked={profile.is_active}
                            />
                            Active
                          </label>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatJoined(profile.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <form id={formId} action={setProfileAccess}>
                            <input type="hidden" name="id" value={profile.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
                            >
                              Save
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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