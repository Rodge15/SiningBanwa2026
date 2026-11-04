-- Phase 8: one showing per date and time, plus manual payment review.
-- This file does not drop tables or booking rows.
-- It does replace three booking functions, because PostgreSQL cannot rename
-- an argument with CREATE OR REPLACE. The old argument was p_event_id.
-- The new argument is p_showing_id. The drop removes only that function,
-- not the reservations table.
--
-- Where to run it:
-- 1. Open the Supabase dashboard for this project.
-- 2. Go to SQL Editor, then New query.
-- 3. Paste this whole file.
-- 4. Run it once, after 20261027120000_booking_rules_and_admin_bookings.sql.
-- 5. If a line says an object already exists, paste this file and run it again.
--
-- After it succeeds, refresh the app. Do not run Phase 9 SQL.

-- A stacked seat map can sit lower than the old 4000-pixel limit.
alter table public.event_sections drop constraint if exists event_sections_pos_check;
alter table public.event_sections
  add constraint event_sections_pos_check check (pos_x between 0 and 20000 and pos_y between 0 and 20000);

alter table public.event_rows drop constraint if exists event_rows_pos_check;
alter table public.event_rows
  add constraint event_rows_pos_check check (pos_x between 0 and 20000 and pos_y between 0 and 20000);

alter table public.event_seats drop constraint if exists event_seats_pos_check;
alter table public.event_seats
  add constraint event_seats_pos_check check (pos_x between 0 and 20000 and pos_y between 0 and 20000);

-- These unique checks must wait until the end of the save, or a second save can fail.
alter table public.event_rows drop constraint if exists event_rows_position_unique;
alter table public.event_rows
  add constraint event_rows_position_unique unique (section_id, sort_order) deferrable initially immediate;

alter table public.event_seats drop constraint if exists event_seats_box_unique;
alter table public.event_seats
  add constraint event_seats_box_unique unique (row_id, col_index) deferrable initially immediate;

alter table public.events
  add column if not exists run_start_date date,
  add column if not exists run_end_date date,
  add column if not exists show_times text[] not null default '{}',
  add column if not exists layout_saved_at timestamptz;

comment on column public.events.layout_saved_at is
  'Set when a seated layout with at least one open seat is saved. Publishing requires this.';

create table if not exists public.showings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  starts_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now(),
  constraint showings_event_start_unique unique (event_id, starts_at)
);

comment on table public.showings is
  'One row is one date and start time. Seats and tickets are counted on this row, not shared across the run.';

create table if not exists public.showing_seats (
  showing_id uuid not null references public.showings (id) on delete cascade,
  seat_id uuid not null references public.event_seats (id) on delete cascade,
  status text not null default 'available',
  primary key (showing_id, seat_id),
  constraint showing_seats_status_check check (status in ('available', 'blocked', 'reserved', 'sold', 'locked'))
);

comment on table public.showing_seats is
  'Hold, reserved, and sold status for one seat at one showing. The layout status stays on event_seats.';

alter table public.reservations
  add column if not exists showing_id uuid references public.showings (id);

alter table public.reservation_items
  add column if not exists showing_id uuid references public.showings (id);

create index if not exists reservations_showing_idx on public.reservations (showing_id);
create index if not exists reservation_items_showing_idx on public.reservation_items (showing_id);
create index if not exists showing_seats_status_idx on public.showing_seats (showing_id, status);

-- The old index blocked the same physical seat in a later showing.
drop index if exists public.reservation_items_active_seat_idx;
create unique index if not exists reservation_items_active_showing_seat_idx
  on public.reservation_items (showing_id, seat_id)
  where released_at is null and seat_id is not null;

insert into public.showings (event_id, starts_at, capacity)
select event.id, event.starts_at, event.audience_capacity
from public.events event
where event.starts_at is not null
on conflict (event_id, starts_at) do nothing;

update public.events event
set
  run_start_date = (event.starts_at at time zone 'Asia/Manila')::date,
  run_end_date = (event.starts_at at time zone 'Asia/Manila')::date,
  show_times = array[to_char(event.starts_at at time zone 'Asia/Manila', 'HH24:MI')]
where event.starts_at is not null
  and event.run_start_date is null;

update public.reservations reservation
set showing_id = showing.id
from public.showings showing
where showing.event_id = reservation.event_id
  and reservation.showing_id is null;

update public.reservation_items item
set showing_id = reservation.showing_id
from public.reservations reservation
where reservation.id = item.reservation_id
  and item.showing_id is null;

insert into public.showing_seats (showing_id, seat_id, status)
select showing.id, seat.id,
  case
    when seat.status in ('locked', 'reserved', 'sold', 'blocked') then seat.status
    else 'available'
  end
from public.showings showing
join public.event_seats seat on seat.event_id = showing.event_id
on conflict (showing_id, seat_id) do nothing;

update public.event_seats
set status = 'available'
where status in ('locked', 'reserved', 'sold');

update public.events event
set layout_saved_at = now()
where event.layout_saved_at is null
  and exists (
    select 1
    from public.event_seats seat
    where seat.event_id = event.id
      and seat.status <> 'blocked'
  );

create table if not exists public.payment_settings (
  id integer primary key check (id = 1),
  instructions text not null default 'Pay the exact amount, then submit your reference number and screenshot. A staff member will check it. This is not automatic.',
  qr_path text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.payment_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  showing_id uuid references public.showings (id),
  event_id uuid not null references public.events (id),
  customer_id uuid references public.profiles (id),
  status text not null default 'pending',
  amount numeric(10, 2) not null,
  method text not null,
  reference_number text not null,
  proof_path text not null,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  verified_by_name text,
  rejection_note text,
  constraint payments_status_check check (status in ('pending', 'verified', 'rejected')),
  constraint payments_method_check check (method in ('gcash', 'bank')),
  constraint payments_amount_check check (amount >= 0 and amount <= 999999.99),
  constraint payments_reference_check check (reference_number ~ '^[A-Za-z0-9-]{4,40}$'),
  constraint payments_note_check check (rejection_note is null or char_length(rejection_note) <= 200)
);

create unique index if not exists payments_one_pending_idx
  on public.payments (reservation_id)
  where status = 'pending';

create index if not exists payments_status_idx on public.payments (status, submitted_at);

comment on table public.payments is
  'Manual payment proof. Amount is copied from the reservation. Staff approve or reject it. There is no automatic check.';

alter table public.showings enable row level security;
alter table public.showing_seats enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payments enable row level security;

drop policy if exists showings_select on public.showings;
create policy showings_select on public.showings
  for select to authenticated
  using (true);

drop policy if exists showing_seats_select on public.showing_seats;
create policy showing_seats_select on public.showing_seats
  for select to authenticated
  using (true);

drop policy if exists payment_settings_select on public.payment_settings;
create policy payment_settings_select on public.payment_settings
  for select to authenticated
  using (true);

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (customer_id = auth.uid() or public.is_event_manager());

grant select on public.showings, public.showing_seats, public.payment_settings, public.payments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('payment-qr', 'payment-qr', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.sync_showing_seats(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.showing_seats (showing_id, seat_id, status)
  select showing.id, seat.id, case when seat.status = 'blocked' then 'blocked' else 'available' end
  from public.showings showing
  join public.event_seats seat on seat.event_id = showing.event_id
  where showing.event_id = p_event_id
  on conflict (showing_id, seat_id) do nothing;

  update public.showing_seats held
  set status = case when seat.status = 'blocked' then 'blocked' else 'available' end
  from public.event_seats seat
  join public.showings showing on showing.event_id = seat.event_id
  where held.showing_id = showing.id
    and held.seat_id = seat.id
    and seat.event_id = p_event_id
    and held.status in ('available', 'blocked');

  delete from public.showing_seats held
  using public.showings showing
  where held.showing_id = showing.id
    and showing.event_id = p_event_id
    and held.status not in ('locked', 'reserved', 'sold')
    and not exists (
      select 1 from public.event_seats seat
      where seat.id = held.seat_id
        and seat.event_id = p_event_id
    );
end;
$$;

revoke all on function public.sync_showing_seats(uuid) from public, anon, authenticated;

create or replace function public.replace_event_showings(
  p_event_id uuid,
  p_starts timestamptz[],
  p_run_start date,
  p_run_end date,
  p_times text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_count integer;
begin
  if not public.is_event_manager() then
    raise exception 'Only an administrator or staff member can set showtimes.';
  end if;

  if p_starts is null or cardinality(p_starts) < 1 or cardinality(p_starts) > 248 then
    raise exception 'Add at least one showing, and no more than 248.';
  end if;

  if exists (select 1 from unnest(p_starts) start_at where start_at is null)
    or (select count(distinct start_at) from unnest(p_starts) start_at) <> cardinality(p_starts) then
    raise exception 'Each date and time must be a real, different showing.';
  end if;

  select audience_capacity into v_capacity
  from public.events
  where id = p_event_id
  for update;

  if v_capacity is null then
    raise exception 'That event could not be found.';
  end if;

  if exists (
    select 1
    from public.showings showing
    where showing.event_id = p_event_id
      and showing.starts_at <> all (p_starts)
      and exists (
        select 1
        from public.reservations reservation
        where reservation.showing_id = showing.id
          and reservation.status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed', 'rejected')
      )
  ) then
    raise exception 'A showing with a booking cannot be removed. Keep that date and time.';
  end if;

  delete from public.showing_seats held
  using public.showings showing
  where held.showing_id = showing.id
    and showing.event_id = p_event_id
    and showing.starts_at <> all (p_starts);

  delete from public.showings
  where event_id = p_event_id
    and starts_at <> all (p_starts);

  insert into public.showings (event_id, starts_at, capacity)
  select p_event_id, start_at, v_capacity
  from unnest(p_starts) start_at
  on conflict (event_id, starts_at) do update
  set capacity = excluded.capacity;

  perform public.sync_showing_seats(p_event_id);

  update public.events
  set
    starts_at = (select min(start_at) from unnest(p_starts) start_at),
    run_start_date = p_run_start,
    run_end_date = p_run_end,
    show_times = coalesce(p_times, '{}')
  where id = p_event_id;

  get diagnostics v_count = row_count;

  if v_count <> 1 then
    raise exception 'Showtimes could not be saved on that event.';
  end if;
end;
$$;

revoke all on function public.replace_event_showings(uuid, timestamptz[], date, date, text[]) from public, anon;
grant execute on function public.replace_event_showings(uuid, timestamptz[], date, date, text[]) to authenticated;

create or replace function public.guard_event_publish()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if not exists (select 1 from public.showings where event_id = new.id) then
      raise exception 'Add at least one showing before publishing.';
    end if;

    if new.admission_type = 'seated' and (
      new.layout_saved_at is null
      or not exists (
        select 1 from public.event_seats seat
        where seat.event_id = new.id
          and seat.status <> 'blocked'
      )
    ) then
      raise exception 'Save a seating layout before publishing this seated event.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_guard_publish on public.events;
create trigger events_guard_publish
  before insert or update on public.events
  for each row
  execute function public.guard_event_publish();

create or replace function public.sync_showing_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_taken integer;
begin
  if new.audience_capacity is distinct from old.audience_capacity then
    select coalesce(max(held.taken), 0)
    into v_taken
    from (
      select sum(reservation.ticket_quantity) as taken
      from public.reservations reservation
      where reservation.event_id = new.id
        and reservation.ticket_quantity > 0
        and reservation.status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed', 'rejected')
      group by reservation.showing_id
    ) held;

    if v_taken > new.audience_capacity then
      raise exception 'Audience capacity cannot be lower than the tickets already reserved for a showing.';
    end if;

    update public.showings
    set capacity = new.audience_capacity
    where event_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists events_sync_showing_capacity on public.events;
create trigger events_sync_showing_capacity
  before update on public.events
  for each row
  execute function public.sync_showing_capacity();

-- Replace the layout save so a second save does not fail, and large maps fit.
create or replace function public.save_event_layout(p_event_id uuid, p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_seat_count integer;
begin
  if not public.is_event_manager() then
    raise exception 'Only an administrator or staff member can save a seat layout.';
  end if;

  select admission_type
  into v_type
  from public.events
  where id = p_event_id
  for update;

  if v_type is null then
    raise exception 'That event could not be found.';
  end if;

  if v_type <> 'seated' then
    raise exception 'A general admission event does not use a seat map.';
  end if;

  if jsonb_typeof(p_layout -> 'sections') <> 'array' then
    raise exception 'Seat layout must include a sections list.';
  end if;

  select count(*) into v_seat_count
  from public.seat_layout_seats(p_layout);

  if v_seat_count < 1 then
    raise exception 'Add at least one seat before saving the layout.';
  end if;

  if v_seat_count > 2000 then
    raise exception 'A layout can have at most 2000 seats.';
  end if;

  if exists (
    select 1 from public.seat_layout_sections(p_layout)
    where pos_x < 0 or pos_x > 20000 or pos_y < 0 or pos_y > 20000
  ) or exists (
    select 1 from public.seat_layout_rows(p_layout)
    where pos_x < 0 or pos_x > 20000 or pos_y < 0 or pos_y > 20000
  ) or exists (
    select 1 from public.seat_layout_seats(p_layout)
    where pos_x < 0 or pos_x > 20000 or pos_y < 0 or pos_y > 20000
  ) then
    raise exception 'A section, row, or seat is too far down the canvas. Move it up, then save again.';
  end if;

  if exists (
    select 1 from public.seat_layout_sections(p_layout)
    where tier not in ('regular', 'semi_vip', 'vip')
      or default_price < 0 or default_price > 999999.99
  ) or exists (
    select 1 from public.seat_layout_rows(p_layout)
    where tier not in ('regular', 'semi_vip', 'vip')
      or price < 0 or price > 999999.99
  ) or exists (
    select 1 from public.seat_layout_seats(p_layout)
    where status not in ('available', 'blocked', 'reserved', 'sold', 'locked')
  ) then
    raise exception 'A section, row, or seat has an invalid tier, price, or status.';
  end if;

  if exists (
    select 1
    from public.showing_seats held
    join public.showings showing on showing.id = held.showing_id
    join public.event_seats seat on seat.id = held.seat_id
    left join public.seat_layout_seats(p_layout) incoming on incoming.id = seat.id
    left join public.seat_layout_rows(p_layout) new_row on new_row.id = incoming.row_id
    left join public.seat_layout_sections(p_layout) new_section on new_section.id = incoming.section_id
    where showing.event_id = p_event_id
      and held.status in ('reserved', 'sold', 'locked')
      and (
        incoming.id is null
        or incoming.label is distinct from seat.label
        or incoming.section_id is distinct from seat.section_id
        or incoming.row_id is distinct from seat.row_id
        or incoming.col_index is distinct from seat.col_index
        or incoming.pos_x is distinct from seat.pos_x
        or incoming.pos_y is distinct from seat.pos_y
        or coalesce(incoming.price_override, new_row.price, new_section.default_price)
          is distinct from coalesce(seat.price_override, (
            select old_row.price from public.event_rows old_row where old_row.id = seat.row_id
          ), (
            select old_section.default_price from public.event_sections old_section where old_section.id = seat.section_id
          ))
      )
  ) then
    raise exception 'A reserved, sold, or on-hold seat cannot be moved, removed, or repriced.';
  end if;

  set constraints event_rows_position_unique, event_seats_box_unique deferred;

  update public.event_sections section
  set name = 's' || numbered.n::text
  from (
    select id, row_number() over (order by id) as n
    from public.event_sections
    where event_id = p_event_id
  ) numbered
  where section.id = numbered.id;

  update public.event_rows event_row
  set label = 'r' || numbered.n::text
  from (
    select id, row_number() over (order by id) as n
    from public.event_rows
    where event_id = p_event_id
  ) numbered
  where event_row.id = numbered.id;

  update public.event_seats seat
  set label = 't' || numbered.n::text
  from (
    select id, row_number() over (order by id) as n
    from public.event_seats
    where event_id = p_event_id
  ) numbered
  where seat.id = numbered.id;

  insert into public.event_sections (
    id, event_id, name, default_price, tier, sort_order, column_count, pos_x, pos_y
  )
  select id, p_event_id, name, default_price, tier, sort_order, column_count, pos_x, pos_y
  from public.seat_layout_sections(p_layout)
  on conflict (id) do update
  set
    name = excluded.name,
    default_price = excluded.default_price,
    tier = excluded.tier,
    sort_order = excluded.sort_order,
    column_count = excluded.column_count,
    pos_x = excluded.pos_x,
    pos_y = excluded.pos_y
  where public.event_sections.event_id = p_event_id;

  insert into public.event_rows (
    id, event_id, section_id, label, tier, price, sort_order, pos_x, pos_y
  )
  select id, p_event_id, section_id, label, tier, price, sort_order, pos_x, pos_y
  from public.seat_layout_rows(p_layout)
  on conflict (id) do update
  set
    section_id = excluded.section_id,
    label = excluded.label,
    tier = excluded.tier,
    price = excluded.price,
    sort_order = excluded.sort_order,
    pos_x = excluded.pos_x,
    pos_y = excluded.pos_y
  where public.event_rows.event_id = p_event_id;

  insert into public.event_seats (
    id, event_id, section_id, row_id, label, row_index, col_index, pos_x, pos_y, price_override, status
  )
  select
    incoming.id,
    p_event_id,
    incoming.section_id,
    incoming.row_id,
    incoming.label,
    new_row.sort_order,
    incoming.col_index,
    incoming.pos_x,
    incoming.pos_y,
    case
      when exists (
        select 1
        from public.showing_seats held
        join public.showings showing on showing.id = held.showing_id
        where held.seat_id = incoming.id
          and showing.event_id = p_event_id
          and held.status in ('reserved', 'sold', 'locked')
      ) then seat.price_override
      else incoming.price_override
    end,
    case when incoming.status = 'blocked' then 'blocked' else 'available' end
  from public.seat_layout_seats(p_layout) incoming
  join public.seat_layout_rows(p_layout) new_row on new_row.id = incoming.row_id
  left join public.event_seats seat
    on seat.id = incoming.id
    and seat.event_id = p_event_id
  on conflict (id) do update
  set
    section_id = excluded.section_id,
    row_id = excluded.row_id,
    label = excluded.label,
    row_index = excluded.row_index,
    col_index = excluded.col_index,
    pos_x = excluded.pos_x,
    pos_y = excluded.pos_y,
    price_override = excluded.price_override,
    status = excluded.status
  where public.event_seats.event_id = p_event_id;

  delete from public.showing_seats held
  using public.showings showing
  where held.showing_id = showing.id
    and showing.event_id = p_event_id
    and held.status not in ('locked', 'reserved', 'sold')
    and held.seat_id not in (select id from public.seat_layout_seats(p_layout));

  delete from public.event_seats
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_seats(p_layout));

  delete from public.event_rows
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_rows(p_layout));

  delete from public.event_sections
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_sections(p_layout));

  perform public.sync_showing_seats(p_event_id);

  -- The designed seats are the capacity. Do not reject a map that is larger than the old number.
  update public.events
  set
    audience_capacity = v_seat_count,
    layout_saved_at = case
      when exists (
        select 1 from public.event_seats seat
        where seat.event_id = p_event_id
          and seat.status <> 'blocked'
      ) then now()
      else null
    end
  where id = p_event_id;
exception
  when unique_violation then
    raise exception 'The layout could not be saved because two sections, rows, or seats would share the same name or place.';
  when check_violation then
    raise exception 'The layout could not be saved because a price, position, or label is not allowed.';
end;
$$;

create or replace function public.release_expired_seat_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_ids uuid[];
  v_count integer := 0;
begin
  select coalesce(array_agg(reservation.id order by reservation.id), '{}'::uuid[])
  into v_reservation_ids
  from public.reservations reservation
  where reservation.status in ('awaiting_payment', 'rejected')
    and reservation.hold_expires_at is not null
    and reservation.hold_expires_at <= now()
    and not exists (
      select 1
      from public.payments payment
      where payment.reservation_id = reservation.id
        and payment.status = 'pending'
    );

  if cardinality(v_reservation_ids) = 0 then
    return 0;
  end if;

  perform 1
  from public.reservations
  where id = any(v_reservation_ids)
  order by id
  for update;

  update public.showing_seats held
  set status = 'available'
  from public.reservation_items item
  where item.showing_id = held.showing_id
    and item.seat_id = held.seat_id
    and item.reservation_id = any(v_reservation_ids)
    and item.released_at is null
    and held.status = 'locked';

  update public.reservation_items
  set released_at = now()
  where reservation_id = any(v_reservation_ids)
    and released_at is null;

  update public.reservations
  set status = 'expired'
  where id = any(v_reservation_ids)
    and status in ('awaiting_payment', 'rejected');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Same argument types as the old function, but the first name changed.
drop function if exists public.create_online_reservation(uuid, uuid[]);

create or replace function public.create_online_reservation(p_showing_id uuid, p_seat_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hold_minutes integer;
  v_event_id uuid;
  v_title text;
  v_type text;
  v_starts timestamptz;
  v_closed text;
  v_name text;
  v_phone text;
  v_email text;
  v_total numeric(10, 2);
  v_reservation_id uuid := gen_random_uuid();
  v_found integer;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'Log in before reserving seats.';
  end if;

  select full_name, phone, email
  into v_name, v_phone, v_email
  from public.profiles
  where id = v_user and role = 'customer' and is_active;

  if not found then
    raise exception 'Only an active customer can reserve seats.';
  end if;

  v_name := left(coalesce(nullif(btrim(v_name), ''), nullif(v_email, ''), 'Customer'), 120);

  if p_seat_ids is null or cardinality(p_seat_ids) < 1 or cardinality(p_seat_ids) > 10 then
    raise exception 'Select 1 to 10 seats.';
  end if;

  perform public.release_expired_seat_holds();

  select event.id, event.title, event.admission_type, showing.starts_at
  into v_event_id, v_title, v_type, v_starts
  from public.showings showing
  join public.events event on event.id = showing.event_id
  where showing.id = p_showing_id
    and event.status = 'published'
  for update of showing;

  if v_title is null then
    raise exception 'That showing is not open for reservations.';
  end if;

  if v_type <> 'seated' then
    raise exception 'This show sells tickets, not specific seats.';
  end if;

  if not exists (
    select 1 from public.event_seats seat
    where seat.event_id = v_event_id
      and seat.status <> 'blocked'
  ) then
    raise exception 'No seating layout has been saved for this event yet.';
  end if;

  v_closed := public.online_sales_closed_reason(v_starts);

  if v_closed is not null then
    raise exception '%', v_closed;
  end if;

  select hold_minutes into v_hold_minutes
  from public.reservation_settings
  where id = 1;

  v_hold_minutes := coalesce(v_hold_minutes, 5);

  perform 1
  from public.showing_seats
  where showing_id = p_showing_id
    and seat_id = any(p_seat_ids)
  order by seat_id
  for update;

  select count(*) into v_found
  from public.showing_seats held
  join public.event_seats seat on seat.id = held.seat_id
  where held.showing_id = p_showing_id
    and held.seat_id = any(p_seat_ids)
    and seat.event_id = v_event_id;

  if v_found <> cardinality(p_seat_ids) then
    raise exception 'One or more seats do not belong to this showing.';
  end if;

  if exists (
    select 1 from public.showing_seats
    where showing_id = p_showing_id
      and seat_id = any(p_seat_ids)
      and status <> 'available'
  ) then
    raise exception 'One or more seats are no longer available.';
  end if;

  select coalesce(sum(coalesce(seat.price_override, event_row.price, section.default_price)), 0)
  into v_total
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
  where seat.id = any(p_seat_ids);

  insert into public.reservations (
    id, event_id, showing_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, v_event_id, p_showing_id, v_user, 'awaiting_payment', v_total, 'online', v_user, v_title,
    now() + make_interval(mins => v_hold_minutes), 0, v_name, v_phone, nullif(v_email, ''), v_name
  );

  insert into public.reservation_items (reservation_id, event_id, showing_id, seat_id, seat_label, unit_price)
  select
    v_reservation_id, v_event_id, p_showing_id, seat.id, seat.label,
    coalesce(seat.price_override, event_row.price, section.default_price)
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
  where seat.id = any(p_seat_ids);

  update public.showing_seats
  set status = 'locked'
  where showing_id = p_showing_id
    and seat_id = any(p_seat_ids)
    and status = 'available';

  get diagnostics v_updated = row_count;

  if v_updated <> cardinality(p_seat_ids) then
    raise exception 'One or more seats are no longer available.';
  end if;

  return v_reservation_id;
exception
  when unique_violation then
    raise exception 'One or more seats were just reserved by someone else.';
end;
$$;

revoke all on function public.create_online_reservation(uuid, uuid[]) from public, anon;
grant execute on function public.create_online_reservation(uuid, uuid[]) to authenticated;

drop function if exists public.create_general_admission_reservation(uuid, integer);

create or replace function public.create_general_admission_reservation(p_showing_id uuid, p_quantity integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hold_minutes integer;
  v_event_id uuid;
  v_title text;
  v_capacity integer;
  v_price numeric(10, 2);
  v_starts timestamptz;
  v_closed text;
  v_taken integer;
  v_name text;
  v_phone text;
  v_email text;
  v_reservation_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Log in before reserving tickets.';
  end if;

  select full_name, phone, email
  into v_name, v_phone, v_email
  from public.profiles
  where id = v_user and role = 'customer' and is_active;

  if not found then
    raise exception 'Only an active customer can reserve tickets.';
  end if;

  v_name := left(coalesce(nullif(btrim(v_name), ''), nullif(v_email, ''), 'Customer'), 120);

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'Choose 1 to 10 tickets.';
  end if;

  perform public.release_expired_seat_holds();

  select event.id, event.title, showing.capacity, event.ticket_price, showing.starts_at
  into v_event_id, v_title, v_capacity, v_price, v_starts
  from public.showings showing
  join public.events event on event.id = showing.event_id
  where showing.id = p_showing_id
    and event.status = 'published'
    and event.admission_type = 'general'
  for update of showing;

  if v_title is null or v_price is null then
    raise exception 'That showing is not open for general admission.';
  end if;

  v_closed := public.online_sales_closed_reason(v_starts);

  if v_closed is not null then
    raise exception '%', v_closed;
  end if;

  select coalesce(sum(ticket_quantity), 0)
  into v_taken
  from public.reservations
  where showing_id = p_showing_id
    and ticket_quantity > 0
    and status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed', 'rejected');

  if v_taken + p_quantity > v_capacity then
    raise exception 'Not enough tickets are left for this showing.';
  end if;

  select hold_minutes into v_hold_minutes from public.reservation_settings where id = 1;
  v_hold_minutes := coalesce(v_hold_minutes, 5);

  insert into public.reservations (
    id, event_id, showing_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, v_event_id, p_showing_id, v_user, 'awaiting_payment', v_price * p_quantity, 'online', v_user,
    v_title, now() + make_interval(mins => v_hold_minutes), p_quantity, v_name, v_phone, nullif(v_email, ''), v_name
  );

  return v_reservation_id;
end;
$$;

revoke all on function public.create_general_admission_reservation(uuid, integer) from public, anon;
grant execute on function public.create_general_admission_reservation(uuid, integer) to authenticated;

drop function if exists public.create_staff_reservation(uuid, text, uuid, text, text, text, uuid[], integer);

create or replace function public.create_staff_reservation(
  p_showing_id uuid,
  p_source text,
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_seat_ids uuid[],
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_staff_name text;
  v_event_id uuid;
  v_title text;
  v_type text;
  v_status text;
  v_capacity integer;
  v_price numeric(10, 2);
  v_name text;
  v_phone text;
  v_email text;
  v_total numeric(10, 2);
  v_taken integer;
  v_found integer;
  v_updated integer;
  v_reservation_id uuid := gen_random_uuid();
  v_seat_ids uuid[] := coalesce(p_seat_ids, '{}'::uuid[]);
begin
  if v_user is null or not public.is_event_manager() then
    raise exception 'Only active staff can record a booking.';
  end if;

  if p_source not in ('admin', 'walk_in') then
    raise exception 'Choose admin or walk-in.';
  end if;

  select left(coalesce(nullif(btrim(full_name), ''), nullif(email, ''), 'Staff'), 120)
  into v_staff_name
  from public.profiles
  where id = v_user;

  if p_customer_id is not null then
    select
      left(coalesce(nullif(btrim(full_name), ''), nullif(email, ''), 'Customer'), 120),
      phone,
      nullif(email, '')
    into v_name, v_phone, v_email
    from public.profiles
    where id = p_customer_id and role = 'customer' and is_active;

    if not found then
      raise exception 'Choose an active customer account.';
    end if;
  else
    v_name := left(btrim(coalesce(p_customer_name, '')), 120);
    v_phone := nullif(left(btrim(coalesce(p_customer_phone, '')), 30), '');
    v_email := nullif(left(btrim(coalesce(p_customer_email, '')), 200), '');

    if char_length(v_name) < 2 then
      raise exception 'Enter the customer name.';
    end if;

    if v_phone is null or char_length(v_phone) < 7 then
      raise exception 'Enter a phone number for this customer.';
    end if;
  end if;

  perform public.release_expired_seat_holds();

  select event.id, event.title, event.admission_type, event.status, showing.capacity, event.ticket_price
  into v_event_id, v_title, v_type, v_status, v_capacity, v_price
  from public.showings showing
  join public.events event on event.id = showing.event_id
  where showing.id = p_showing_id
  for update of showing;

  if v_title is null or v_status = 'cancelled' then
    raise exception 'That showing cannot be booked.';
  end if;

  if v_type = 'general' then
    if cardinality(v_seat_ids) > 0 then
      raise exception 'This show sells tickets, not specific seats.';
    end if;

    if p_quantity is null or p_quantity < 1 or p_quantity > 40 then
      raise exception 'Choose 1 to 40 tickets.';
    end if;

    if v_price is null then
      raise exception 'This show has no ticket price.';
    end if;

    select coalesce(sum(ticket_quantity), 0)
    into v_taken
    from public.reservations
    where showing_id = p_showing_id
      and ticket_quantity > 0
      and status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed', 'rejected');

    if v_taken + p_quantity > v_capacity then
      raise exception 'Not enough tickets are left for this showing.';
    end if;

    insert into public.reservations (
      id, event_id, showing_id, customer_id, status, total_amount, source, created_by, event_title,
      hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
    )
    values (
      v_reservation_id, v_event_id, p_showing_id, p_customer_id, 'confirmed', v_price * p_quantity, p_source, v_user,
      v_title, null, p_quantity, v_name, v_phone, v_email, v_staff_name
    );

    return v_reservation_id;
  end if;

  if cardinality(v_seat_ids) < 1 or cardinality(v_seat_ids) > 40 then
    raise exception 'Select 1 to 40 seats.';
  end if;

  perform 1
  from public.showing_seats
  where showing_id = p_showing_id
    and seat_id = any(v_seat_ids)
  order by seat_id
  for update;

  select count(*) into v_found
  from public.showing_seats
  where showing_id = p_showing_id
    and seat_id = any(v_seat_ids);

  if v_found <> cardinality(v_seat_ids) then
    raise exception 'One or more seats do not belong to this showing.';
  end if;

  if exists (
    select 1 from public.showing_seats
    where showing_id = p_showing_id
      and seat_id = any(v_seat_ids)
      and status <> 'available'
  ) then
    raise exception 'One or more seats are no longer available.';
  end if;

  select coalesce(sum(coalesce(seat.price_override, event_row.price, section.default_price)), 0)
  into v_total
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
  where seat.id = any(v_seat_ids);

  insert into public.reservations (
    id, event_id, showing_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, v_event_id, p_showing_id, p_customer_id, 'confirmed', v_total, p_source, v_user, v_title,
    null, 0, v_name, v_phone, v_email, v_staff_name
  );

  insert into public.reservation_items (reservation_id, event_id, showing_id, seat_id, seat_label, unit_price)
  select
    v_reservation_id, v_event_id, p_showing_id, seat.id, seat.label,
    coalesce(seat.price_override, event_row.price, section.default_price)
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
  where seat.id = any(v_seat_ids);

  update public.showing_seats
  set status = 'sold'
  where showing_id = p_showing_id
    and seat_id = any(v_seat_ids)
    and status = 'available';

  get diagnostics v_updated = row_count;

  if v_updated <> cardinality(v_seat_ids) then
    raise exception 'One or more seats are no longer available.';
  end if;

  return v_reservation_id;
exception
  when unique_violation then
    raise exception 'One or more seats were just sold by someone else.';
end;
$$;

revoke all on function public.create_staff_reservation(uuid, text, uuid, text, text, text, uuid[], integer) from public, anon;
grant execute on function public.create_staff_reservation(uuid, text, uuid, text, text, text, uuid[], integer) to authenticated;

create or replace function public.submit_payment_proof(
  p_reservation_id uuid,
  p_method text,
  p_reference text,
  p_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event_id uuid;
  v_showing_id uuid;
  v_status text;
  v_source text;
  v_amount numeric(10, 2);
  v_starts timestamptz;
  v_closed text;
  v_hold timestamptz;
  v_payment_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Log in before submitting payment.';
  end if;

  if p_method not in ('gcash', 'bank') then
    raise exception 'Choose GCash or bank transfer.';
  end if;

  if p_reference is null or p_reference !~ '^[A-Za-z0-9-]{4,40}$' then
    raise exception 'Enter the payment reference (4 to 40 letters, numbers, or hyphens).';
  end if;

  if p_proof_path is null or p_proof_path !~ '^[A-Za-z0-9_./-]{8,200}$' or left(p_proof_path, 1) = '/' then
    raise exception 'The payment screenshot could not be stored.';
  end if;

  perform public.release_expired_seat_holds();

  select reservation.event_id, reservation.showing_id, reservation.status, reservation.source,
    reservation.total_amount, reservation.hold_expires_at, showing.starts_at
  into v_event_id, v_showing_id, v_status, v_source, v_amount, v_hold, v_starts
  from public.reservations reservation
  left join public.showings showing on showing.id = reservation.showing_id
  where reservation.id = p_reservation_id
    and reservation.customer_id = v_user
  for update of reservation;

  if v_status is null then
    raise exception 'That reservation could not be found.';
  end if;

  if v_source <> 'online' then
    raise exception 'This booking was recorded by staff and does not use online payment.';
  end if;

  if v_status not in ('awaiting_payment', 'rejected') then
    raise exception 'This reservation is not waiting for a payment proof.';
  end if;

  if v_status = 'rejected' and (v_hold is null or v_hold <= now()) then
    raise exception 'The resubmit time has passed. Those seats were released.';
  end if;

  if v_starts is null then
    raise exception 'This reservation has no showing.';
  end if;

  v_closed := public.online_sales_closed_reason(v_starts);

  if v_closed is not null then
    raise exception '%', v_closed;
  end if;

  if exists (
    select 1 from public.payments
    where reservation_id = p_reservation_id
      and status = 'pending'
  ) then
    raise exception 'A payment proof is already waiting for review.';
  end if;

  insert into public.payments (
    id, reservation_id, showing_id, event_id, customer_id, status, amount, method,
    reference_number, proof_path, submitted_at
  )
  values (
    v_payment_id, p_reservation_id, v_showing_id, v_event_id, v_user, 'pending', v_amount, p_method,
    p_reference, p_proof_path, now()
  );

  update public.reservations
  set
    status = 'payment_verification',
    payment_submitted_at = now(),
    hold_expires_at = null
  where id = p_reservation_id;

  return v_payment_id;
end;
$$;

revoke all on function public.submit_payment_proof(uuid, text, text, text) from public, anon;
grant execute on function public.submit_payment_proof(uuid, text, text, text) to authenticated;

create or replace function public.review_payment(p_payment_id uuid, p_decision text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_staff_name text;
  v_reservation_id uuid;
  v_showing_id uuid;
  v_status text;
  v_hold_minutes integer;
begin
  if v_user is null or not public.is_event_manager() then
    raise exception 'Only active staff can review a payment.';
  end if;

  if p_decision not in ('verified', 'rejected') then
    raise exception 'Choose approve or reject.';
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 200 then
    raise exception 'The note must be 200 characters or fewer.';
  end if;

  select left(coalesce(nullif(btrim(full_name), ''), nullif(email, ''), 'Staff'), 120)
  into v_staff_name
  from public.profiles
  where id = v_user;

  select reservation_id, showing_id, status
  into v_reservation_id, v_showing_id, v_status
  from public.payments
  where id = p_payment_id
  for update;

  if v_status is null then
    raise exception 'That payment could not be found.';
  end if;

  if v_status <> 'pending' then
    raise exception 'This payment was already reviewed.';
  end if;

  perform 1 from public.reservations where id = v_reservation_id for update;

  if p_decision = 'verified' then
    update public.payments
    set
      status = 'verified',
      verified_at = now(),
      verified_by = v_user,
      verified_by_name = v_staff_name,
      rejection_note = null
    where id = p_payment_id;

    update public.showing_seats held
    set status = 'sold'
    from public.reservation_items item
    where item.reservation_id = v_reservation_id
      and item.released_at is null
      and item.showing_id = held.showing_id
      and item.seat_id = held.seat_id
      and held.status in ('locked', 'reserved');

    update public.reservations
    set status = 'confirmed', hold_expires_at = null
    where id = v_reservation_id;

    return;
  end if;

  select hold_minutes into v_hold_minutes from public.reservation_settings where id = 1;
  v_hold_minutes := coalesce(v_hold_minutes, 5);

  update public.payments
  set
    status = 'rejected',
    verified_at = now(),
    verified_by = v_user,
    verified_by_name = v_staff_name,
    rejection_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_payment_id;

  update public.reservations
  set
    status = 'rejected',
    hold_expires_at = now() + make_interval(mins => v_hold_minutes)
  where id = v_reservation_id;
end;
$$;

revoke all on function public.review_payment(uuid, text, text) from public, anon;
grant execute on function public.review_payment(uuid, text, text) to authenticated;

create or replace function public.save_payment_instructions(p_instructions text, p_qr_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_manager() then
    raise exception 'Only active staff can change payment instructions.';
  end if;

  if p_instructions is null or char_length(btrim(p_instructions)) < 10 or char_length(p_instructions) > 1000 then
    raise exception 'Payment instructions must be 10 to 1000 characters.';
  end if;

  if p_qr_path is not null and (p_qr_path !~ '^[A-Za-z0-9_./-]{8,200}$' or left(p_qr_path, 1) = '/') then
    raise exception 'The QR image could not be stored.';
  end if;

  update public.payment_settings
  set
    instructions = btrim(p_instructions),
    qr_path = coalesce(p_qr_path, qr_path),
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;
end;
$$;

revoke all on function public.save_payment_instructions(text, text) from public, anon;
grant execute on function public.save_payment_instructions(text, text) to authenticated;

create or replace function public.cancel_online_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_showing_id uuid;
begin
  if v_user is null then
    raise exception 'Log in before cancelling a reservation.';
  end if;

  perform public.release_expired_seat_holds();

  select showing_id
  into v_showing_id
  from public.reservations
  where id = p_reservation_id
  for update;

  if not exists (
    select 1
    from public.reservations reservation
    where reservation.id = p_reservation_id
      and reservation.customer_id = v_user
      and reservation.source = 'online'
      and reservation.status in ('awaiting_payment', 'rejected')
      and not exists (
        select 1
        from public.payments payment
        where payment.reservation_id = reservation.id
          and payment.status = 'pending'
      )
  ) then
    raise exception 'This hold can no longer be cancelled.';
  end if;

  update public.showing_seats held
  set status = 'available'
  from public.reservation_items item
  where item.reservation_id = p_reservation_id
    and item.released_at is null
    and item.showing_id = held.showing_id
    and item.seat_id = held.seat_id
    and held.status = 'locked';

  update public.reservation_items
  set released_at = now()
  where reservation_id = p_reservation_id
    and released_at is null;

  update public.reservations
  set status = 'cancelled', hold_expires_at = null
  where id = p_reservation_id;
end;
$$;
