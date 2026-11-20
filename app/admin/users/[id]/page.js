import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { adminUpdateUser, deleteUser } from "@/app/actions/admin";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { QueryMessage } from "@/components/QueryMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { fieldClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { ADMIN_ROLES, ROLES, roleLabel } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = {
  title: "Edit user | Sining Banwa",
};

async function EditUser({ params, searchParams }) {
  const { user } = await requireRole(ADMIN_ROLES);
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isSelf = profile.id === user.id;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <Link href="/admin/users" className="text-sm text-brand hover:underline">
        &larr; Back to users
      </Link>

      <Suspense fallback={null}>
        <QueryMessage searchParams={searchParams} />
      </Suspense>

      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Edit user</h1>
        <p className="mt-2 text-sm text-muted">{profile.email}</p>

        {isSelf ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This is your own account. Edit your details in{" "}
            <Link href="/account/profile" className="font-medium underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <form action={adminUpdateUser} className="mt-6 space-y-3">
            <input type="hidden" name="id" value={profile.id} />
            <div>
              <label htmlFor="fullName" className="text-sm font-medium">
                Complete name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profile.full_name || ""}
                minLength={2}
                maxLength={120}
                required
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={profile.email || ""}
                required
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="phone" className="text-sm font-medium">
                Phone number <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone || ""}
                maxLength={30}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <select id="role" name="role" defaultValue={profile.role} className={fieldClass}>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={profile.is_active} />
              Active (can log in)
            </label>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </form>
        )}
      </section>

      {!isSelf ? (
        <section className="rounded-2xl border border-red-200 bg-card p-6">
          <h2 className="text-lg font-semibold text-red-800">Danger zone</h2>
          <p className="mt-2 text-sm text-muted">
            Deleting removes the account permanently. If the person has bookings or payments, set them
            to inactive instead.
          </p>
          <form action={deleteUser} className="mt-4">
            <input type="hidden" name="id" value={profile.id} />
            <DeleteUserButton />
          </form>
        </section>
      ) : null}
    </div>
  );
}

export default function EditUserPage({ params, searchParams }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading user...</p>}>
      <EditUser params={params} searchParams={searchParams} />
    </Suspense>
  );
}