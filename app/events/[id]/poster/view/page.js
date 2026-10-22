import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/formStyles";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/eventRules";
import { getVisibleEvent } from "@/lib/events";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";

export const metadata = {
  title: "Poster | Sining Banwa",
};

async function PosterView({ params }) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const { data, error } = await getVisibleEvent(id);

  if (error || !data?.poster_path) {
    notFound();
  }

  if (data.status !== "published") {
    const { profile } = await getCurrentProfile();

    if (!profile?.is_active || !EVENT_MANAGER_ROLES.includes(profile.role)) {
      notFound();
    }
  }

  const backHref = data.status === "published" ? `/events/${data.id}` : `/events/manage/${data.id}`;
  const backLabel = data.status === "published" ? "Back to event" : "Back to event editor";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm text-brand hover:underline">
          {backLabel}
        </Link>
        <Link href={backHref} className={buttonClass} aria-label="Close poster preview">
          Close
        </Link>
      </div>
      <figure className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {/* The poster route checks access. next/image could cache a private poster. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/events/${data.id}/poster`} alt={`${data.title} poster`} className="max-h-[70vh] w-full object-contain" />
        <figcaption className="px-4 py-3 text-sm text-muted">
          {data.title}. Use Back or Close to return. This page is only the poster picture.
        </figcaption>
      </figure>
    </section>
  );
}

export default function PosterViewPage({ params }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading poster...</p>}>
      <PosterView params={params} />
    </Suspense>
  );
}
