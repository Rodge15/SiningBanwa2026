import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisibleEvent } from "@/lib/events";
import { isUuid } from "@/lib/eventRules";

export async function GET(_request, { params }) {
  const { id } = await params;

  if (!isUuid(id)) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await getVisibleEvent(id);

  if (error || !data?.poster_path) {
    return new Response("Not found", { status: 404 });
  }

  if (data.status !== "published") {
    const { profile } = await getCurrentProfile();

    if (!profile?.is_active || !EVENT_MANAGER_ROLES.includes(profile.role)) {
      return new Response("Not found", { status: 404 });
    }
  }

  try {
    const admin = createAdminClient();
    const signed = await admin.storage.from("event-posters").createSignedUrl(data.poster_path, 60);

    if (signed.error || !signed.data?.signedUrl) {
      return new Response("Poster unavailable", { status: 404 });
    }

    const response = NextResponse.redirect(signed.data.signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new Response("Poster storage is not configured.", { status: 503 });
  }
}
