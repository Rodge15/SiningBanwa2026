-- Phase 2: events and a small manager list.
-- This file only adds new objects. It does not change or delete existing accounts.
-- Run it yourself in the Supabase SQL editor, or with `supabase db push` after linking the project.
-- Then add your own user as a manager. The README has that one-time SQL snippet.

-- A manager is an administrator or staff member who may create and edit events.
-- Customers cannot insert a row here, so they cannot promote themselves.
create table public.event_managers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('administrator', 'staff')),
  created_at timestamptz not null default now()
);

comment on table public.event_managers is
  'Phase 2 manager list. Phase 3 will move these roles into profiles.';

-- Event records. Cancelling changes status. Rows are not deleted.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  venue text not null,
  starts_at timestamptz not null,
  poster_path text,
  status text not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_title_length check (char_length(trim(title)) between 3 and 120),
    constraint events_description_length check (char_length(trim(description)) between 1 and 5000),
    constraint events_venue_length check (char_length(trim(venue)) between 2 and 200),
  constraint events_status_check check (status in ('draft', 'published', 'completed', 'cancelled')),
  constraint events_poster_path_length check (
    poster_path is null or char_length(poster_path) between 1 and 300
  )
);

comment on column public.events.starts_at is
  'Stored as a UTC instant. The app treats form input as Asia/Manila local time.';

comment on column public.events.poster_path is
  'Private storage path with a generated filename. Null when the event has no poster.';

create index events_public_starts_at_idx
  on public.events (starts_at)
  where status = 'published';

create index events_status_starts_at_idx
  on public.events (status, starts_at);

-- Keep updated_at current, and stop a client from rewriting who created the event.
create or replace function public.protect_event_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'The event creator cannot be changed.';
    end if;

    new.created_at = old.created_at;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create trigger events_protect_row
  before insert or update on public.events
  for each row
  execute function public.protect_event_row();

-- Used by Row Level Security. Guests have no user id, so this returns false for them.
create or replace function public.is_event_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_managers
    where user_id = auth.uid()
      and role in ('administrator', 'staff')
  );
$$;

revoke all on function public.is_event_manager() from public;
grant execute on function public.is_event_manager() to anon, authenticated;

alter table public.event_managers enable row level security;
alter table public.events enable row level security;

revoke all on table public.event_managers from anon, authenticated;
revoke all on table public.events from anon, authenticated;

grant select on table public.event_managers to authenticated;
grant select on table public.events to anon, authenticated;
grant insert, update on table public.events to authenticated;

-- A user may see only their own manager row. There is no insert policy, so the
-- anon and logged-in keys cannot add managers. Add the first manager in the SQL editor.
create policy event_managers_select_own
  on public.event_managers
  for select
  to authenticated
  using (user_id = auth.uid());

-- Guests and customers can read published events. Managers can read every status.
create policy events_select_visible
  on public.events
  for select
  to anon, authenticated
  using (status = 'published' or public.is_event_manager());

create policy events_insert_manager
  on public.events
  for insert
  to authenticated
  with check (public.is_event_manager() and created_by = auth.uid());

create policy events_update_manager
  on public.events
  for update
  to authenticated
  using (public.is_event_manager())
  with check (public.is_event_manager());

-- No delete policy. The API cannot hard-delete an event.

-- Private poster bucket. The browser cannot read these files directly.
-- The app checks the event, then asks the server for a short-lived signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-posters',
  'event-posters',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
