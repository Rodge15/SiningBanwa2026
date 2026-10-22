"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { EVENT_MANAGER_ROLES } from "@/lib/roles";
import { eventSetupMessage, isMissingEventTable } from "@/lib/events";
import { isEventStatus, isUuid, validateEventInput, validatePosterFile } from "@/lib/eventRules";

function fail(path, message) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function succeed(path, message) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

async function requireManager() {
  const { user } = await requireRole(EVENT_MANAGER_ROLES);
  return user;
}

function readPoster(formData) {
  const value = formData.get("poster");

  if (!value || typeof value === "string" || value.size === 0) {
    return null;
  }

  return value;
}

async function checkedPoster(formData, path) {
  const file = readPoster(formData);

  if (!file) {
    return null;
  }

  if (file.size > 5 * 1024 * 1024) {
    fail(path, "Poster must be 5 MiB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validatePosterFile(file, bytes);

  if (!result.ok) {
    fail(path, result.message);
  }

  return result.value;
}

async function savePoster(eventId, poster) {
  const admin = createAdminClient();
  const path = `${eventId}/${crypto.randomUUID()}.${poster.extension}`;
  const { error } = await admin.storage.from("event-posters").upload(path, poster.bytes, {
    contentType: poster.contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Could not store the poster.");
  }

  return path;
}

async function removeStoredPoster(path) {
  if (!path) {
    return;
  }

  const admin = createAdminClient();
  await admin.storage.from("event-posters").remove([path]);
}

async function loadManagedEvent(id, path) {
  if (!isUuid(id)) {
    fail(path, "That event could not be found.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, poster_path, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    fail(path, isMissingEventTable(error) ? eventSetupMessage() : "Could not load that event.");
  }

  if (!data) {
    fail(path, "That event could not be found.");
  }

  return { supabase, event: data };
}

export async function createEvent(formData) {
  const path = "/events/manage/new";
  const user = await requireManager(path);
  const parsed = validateEventInput({
    title: formData.get("title"),
    description: formData.get("description"),
    venue: formData.get("venue"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.ok) {
    fail(path, parsed.message);
  }

  const poster = await checkedPoster(formData, path);
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("events").insert({
    id,
    title: parsed.value.title,
    description: parsed.value.description,
    venue: parsed.value.venue,
    starts_at: parsed.value.startsAt,
    status: "draft",
    created_by: user.id,
  });

  if (error) {
    fail(path, isMissingEventTable(error) ? eventSetupMessage() : error.message);
  }

  if (!poster) {
    succeed(`/events/manage/${id}`, "Draft event saved. It stays hidden until you publish it.");
  }

  try {
    const posterPath = await savePoster(id, poster);
    const { error: posterError } = await supabase
      .from("events")
      .update({ poster_path: posterPath })
      .eq("id", id);

    if (posterError) {
      await removeStoredPoster(posterPath);
      fail(`/events/manage/${id}`, "The event was saved, but the poster could not be attached.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not store the poster.";
    fail(`/events/manage/${id}`, `The event was saved, but the poster was not stored. ${message}`);
  }

  succeed(`/events/manage/${id}`, "Draft event saved with its poster.");
}

export async function updateEvent(formData) {
  const id = String(formData.get("id") || "");
  const path = isUuid(id) ? `/events/manage/${id}` : "/events/manage";
  await requireManager(path);
  const parsed = validateEventInput({
    title: formData.get("title"),
    description: formData.get("description"),
    venue: formData.get("venue"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.ok) {
    fail(path, parsed.message);
  }

  const poster = await checkedPoster(formData, path);
  const removePoster = formData.get("removePoster") === "on";
  const { supabase, event } = await loadManagedEvent(id, path);
  let nextPosterPath = event.poster_path;
  let uploadedPath = null;

  if (poster) {
    try {
      uploadedPath = await savePoster(id, poster);
      nextPosterPath = uploadedPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not store the poster.";
      fail(path, message);
    }
  } else if (removePoster) {
    nextPosterPath = null;
  }

  const { error } = await supabase
    .from("events")
    .update({
      title: parsed.value.title,
      description: parsed.value.description,
      venue: parsed.value.venue,
      starts_at: parsed.value.startsAt,
      poster_path: nextPosterPath,
    })
    .eq("id", id);

  if (error) {
    if (uploadedPath) {
      await removeStoredPoster(uploadedPath);
    }

    fail(path, error.message);
  }

  if (event.poster_path && event.poster_path !== nextPosterPath) {
    await removeStoredPoster(event.poster_path);
  }

  succeed(path, "Event details saved.");
}

export async function updateEventStatus(formData) {
  const id = String(formData.get("id") || "");
  const path = isUuid(id) ? `/events/manage/${id}` : "/events/manage";
  const status = String(formData.get("status") || "");
  await requireManager(path);

  if (!isEventStatus(status)) {
    fail(path, "Choose a valid event status.");
  }

  const { supabase } = await loadManagedEvent(id, path);
  const { error } = await supabase.from("events").update({ status }).eq("id", id);

  if (error) {
    fail(path, error.message);
  }

  const note =
    status === "published"
      ? "Event published. Guests can now open it."
      : status === "cancelled"
        ? "Event cancelled. The record was kept, and guests can no longer open it."
        : `Event marked ${status}.`;

  succeed(path, note);
}
