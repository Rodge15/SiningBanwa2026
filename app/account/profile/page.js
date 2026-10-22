import Link from "next/link";
import { Suspense } from "react";
import { changePassword, updateProfile } from "@/app/actions/profile";
import { QueryMessage } from "@/components/QueryMessage";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { requireRole } from "@/lib/auth";
import { ROLES, roleLabel } from "@/lib/roles";

export const metadata = {
  title: "Profile | Sining Banwa",
};

async function ProfileForm({ searchParams }) {
  const { user, profile } = await requireRole(ROLES);

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="mt-2 text-sm text-muted">
          Email and role stay read-only so you cannot change your own access level.
        </p>
        <Suspense fallback={null}>
          <div className="mt-4">
            <QueryMessage searchParams={searchParams} />
          </div>
        </Suspense>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="font-medium">{profile.email || user.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Role</dt>
            <dd className="font-medium">{roleLabel(profile.role)}</dd>
          </div>
        </dl>
        <form action={updateProfile} className="mt-6 space-y-3">
          <div>
            <label htmlFor="fullName" className="text-sm font-medium">
              Full name
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
            <label htmlFor="phone" className="text-sm font-medium">
              Phone <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={profile.phone || ""}
              maxLength={30}
              className={fieldClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            Save profile
          </button>
        </form>
      </section>
      <section className="rounded-2xl border border-line bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-muted">
          Your current password is checked first. A wrong password does not change anything.
        </p>
        <form action={changePassword} className="mt-4 space-y-3">
          <div>
            <label htmlFor="currentPassword" className="text-sm font-medium">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className={fieldClass}
            />
          </div>
          <button type="submit" className={buttonClass}>
            Change password
          </button>
        </form>
      </section>
    </div>
  );
}

export default function ProfilePage({ searchParams }) {
  return (
    <section className="space-y-4">
      <Link href="/account" className="text-sm text-brand hover:underline">
        Back to dashboard
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading your profile...</p>}>
        <ProfileForm searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
