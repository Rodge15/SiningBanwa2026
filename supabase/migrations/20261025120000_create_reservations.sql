-- Phase 6: online reservations and five-minute seat holds.
-- This file only adds new tables and functions. It does not change or delete events, accounts, or seat layouts.
-- Run it once in the Supabase SQL Editor after the Phase 5 migration.
-- Open SQL Editor, paste this whole file, and click Run.
-- If the project is linked, `supabase db push` from this folder also works.
-- Do not run this file twice. Do not drop these tables.

-- One row controls how long a new hold lasts. The browser cannot change this.
create table public.reservation_settings (
  id integer primary key,
  hold_minutes integer not null default 5,
  updated_at timestamptz not null default now(),
  constraint reservation_settings_one_row check (id = 1),
  constraint reservation_settings_hold_minutes check (hold_minutes between 1 and 60)
);

comment on table public.reservation_settings is
  'Hold length for new online reservations. Change hold_minutes in the SQL Editor. Default is 5.';

insert into public.reservation_settings (id, hold_minutes)
values (1, 5);

-- A reservation is one booking. This phase creates online holds only.
-- source may be admin later, but this phase never inserts that value.
create table public.reservations (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null,
  total_amount numeric(10, 2) not null,
  source text not null default 'online',
  created_by uuid not null references public.profiles (id) on delete restrict,
  event_title text not null,
  hold_expires_at timestamptz,
  payment_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_status_check check (
    status in (
      'pending',
      'awaiting_payment',
      'payment_verification',
      'confirmed',
      'rejected',
      'cancelled',
      'expired'
    )
  ),
  constraint reservations_source_check check (source in ('online', 'admin')),
  constraint reservations_total_check check (total_amount >= 0 and total_amount <= 9999999.99),
  constraint reservations_title_length check (char_length(trim(event_title)) between 3 and 120)
);

comment on table public.reservations is
  'One booking. Phase 6 creates online holds only. Payment proof and staff bookings come later.';

comment on column public.reservations.source is
  'online for a customer hold. admin is reserved for a later manual-booking phase and is not used yet.';

comment on column public.reservations.payment_submitted_at is
  'Null until a later phase records payment proof. Expired holds are released only when this is null.';

comment on column public.reservations.total_amount is
  'Server total in Philippine pesos, copied from seat prices at hold time.';

comment on column public.reservations.event_title is
  'Event title copied at hold time, so the reservation page still has a name if the event changes.';

-- One row per seat. unit_price is the historical price. released_at frees the unique seat lock.
create table public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete restrict,
  event_id uuid not null references public.events (id) on delete restrict,
  seat_id uuid not null references public.event_seats (id) on delete restrict,
  seat_label text not null,
  unit_price numeric(10, 2) not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reservation_items_price_check check (unit_price >= 0 and unit_price <= 999999.99),
  constraint reservation_items_label_length check (char_length(seat_label) between 1 and 40)
);

comment on table public.reservation_items is
  'Seats in a reservation and the price charged for each seat. A null released_at means the seat is still held by this row.';

comment on column public.reservation_items.unit_price is
  'Seat price in Philippine pesos at the moment the hold was created. Later price edits do not change this.';

-- Two active rows cannot point at the same seat. This blocks a duplicate booking.
create unique index reservation_items_active_seat_idx
  on public.reservation_items (seat_id)
  where released_at is null;

create index reservations_customer_idx
  on public.reservations (customer_id, created_at desc);

create index reservations_event_idx
  on public.reservations (event_id);

create index reservations_open_hold_idx
  on public.reservations (hold_expires_at)
  where status = 'awaiting_payment' and payment_submitted_at is null;

create index reservation_items_reservation_idx
  on public.reservation_items (reservation_id);

create or replace function public.touch_reservation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reservations_touch_updated_at
  before update on public.reservations
  for each row
  execute function public.touch_reservation_updated_at();

-- Frees seats whose hold ended and that have no payment proof.
-- Lock seats first, then reservations, so this matches the create function and avoids a deadlock.
create or replace function public.release_expired_seat_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_ids uuid[];
  v_reservation_ids uuid[];
  v_count integer := 0;
begin
  select coalesce(array_agg(seat.id order by seat.id), '{}'::uuid[])
  into v_seat_ids
  from public.event_seats seat
  join public.reservation_items item
    on item.seat_id = seat.id
    and item.released_at is null
  join public.reservations reservation
    on reservation.id = item.reservation_id
  where reservation.status = 'awaiting_payment'
    and reservation.payment_submitted_at is null
    and reservation.hold_expires_at <= now();

  if cardinality(v_seat_ids) = 0 then
    return 0;
  end if;

  perform 1
  from public.event_seats
  where id = any(v_seat_ids)
  order by id
  for update;

  select coalesce(array_agg(reservation.id order by reservation.id), '{}'::uuid[])
  into v_reservation_ids
  from public.reservations reservation
  where reservation.status = 'awaiting_payment'
    and reservation.payment_submitted_at is null
    and reservation.hold_expires_at <= now()
    and exists (
      select 1
      from public.reservation_items item
      where item.reservation_id = reservation.id
        and item.seat_id = any(v_seat_ids)
        and item.released_at is null
    );

  perform 1
  from public.reservations
  where id = any(v_reservation_ids)
  order by id
  for update;

  update public.event_seats seat
  set status = 'available'
  from public.reservation_items item
  where item.seat_id = seat.id
    and item.reservation_id = any(v_reservation_ids)
    and item.released_at is null
    and seat.status = 'locked';

  update public.reservation_items
  set released_at = now()
  where reservation_id = any(v_reservation_ids)
    and released_at is null;

  update public.reservations
  set status = 'expired'
  where id = any(v_reservation_ids)
    and status = 'awaiting_payment'
    and payment_submitted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.release_expired_seat_holds() is
  'Releases expired online holds that have no payment proof. Safe to call whenever seats are read.';

-- Creates one online reservation and locks its seats in the same transaction.
-- Prices come from the seat rows, never from the browser.
create or replace function public.create_online_reservation(p_event_id uuid, p_seat_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hold_minutes integer;
  v_title text;
  v_total numeric(10, 2);
  v_reservation_id uuid := gen_random_uuid();
  v_found integer;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'Log in before reserving seats.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user
      and role = 'customer'
      and is_active
  ) then
    raise exception 'Only an active customer can reserve seats.';
  end if;

  if p_seat_ids is null or cardinality(p_seat_ids) < 1 then
    raise exception 'Select at least one seat.';
  end if;

  if cardinality(p_seat_ids) > 10 then
    raise exception 'You can reserve at most 10 seats at a time.';
  end if;

  if exists (
    select 1
    from unnest(p_seat_ids) as seat_id
    group by seat_id
    having count(*) > 1
  ) then
    raise exception 'Each seat can be selected only once.';
  end if;

  perform public.release_expired_seat_holds();

  select title
  into v_title
  from public.events
  where id = p_event_id
    and status = 'published';

  if v_title is null then
    raise exception 'That event is not open for reservations.';
  end if;

  select hold_minutes
  into v_hold_minutes
  from public.reservation_settings
  where id = 1;

  if v_hold_minutes is null then
    v_hold_minutes := 5;
  end if;

  perform 1
  from public.event_seats
  where id = any(p_seat_ids)
    and event_id = p_event_id
  order by id
  for update;

  select count(*)
  into v_found
  from public.event_seats
  where id = any(p_seat_ids)
    and event_id = p_event_id;

  if v_found <> cardinality(p_seat_ids) then
    raise exception 'One or more seats do not belong to this event.';
  end if;

  if exists (
    select 1
    from public.event_seats
    where id = any(p_seat_ids)
      and status <> 'available'
  ) then
    raise exception 'One or more seats are no longer available.';
  end if;

  select coalesce(sum(coalesce(seat.price_override, section.default_price)), 0)
  into v_total
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  where seat.id = any(p_seat_ids);

  insert into public.reservations (
    id,
    event_id,
    customer_id,
    status,
    total_amount,
    source,
    created_by,
    event_title,
    hold_expires_at
  )
  values (
    v_reservation_id,
    p_event_id,
    v_user,
    'awaiting_payment',
    v_total,
    'online',
    v_user,
    v_title,
    now() + make_interval(mins => v_hold_minutes)
  );

  insert into public.reservation_items (
    reservation_id,
    event_id,
    seat_id,
    seat_label,
    unit_price
  )
  select
    v_reservation_id,
    p_event_id,
    seat.id,
    seat.label,
    coalesce(seat.price_override, section.default_price)
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  where seat.id = any(p_seat_ids);

  update public.event_seats
  set status = 'locked'
  where id = any(p_seat_ids)
    and event_id = p_event_id
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

comment on function public.create_online_reservation(uuid, uuid[]) is
  'Locks selected available seats and saves one online reservation. The total is calculated in the database.';

-- Lets the owner cancel an unpaid hold and free the seats.
create or replace function public.cancel_online_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_seat_ids uuid[];
begin
  if v_user is null then
    raise exception 'Log in before cancelling a reservation.';
  end if;

  perform public.release_expired_seat_holds();

  select coalesce(array_agg(item.seat_id order by item.seat_id), '{}'::uuid[])
  into v_seat_ids
  from public.reservation_items item
  where item.reservation_id = p_reservation_id
    and item.released_at is null;

  if cardinality(v_seat_ids) > 0 then
    perform 1
    from public.event_seats
    where id = any(v_seat_ids)
    order by id
    for update;
  end if;

  perform 1
  from public.reservations
  where id = p_reservation_id
  for update;

  if not exists (
    select 1
    from public.reservations
    where id = p_reservation_id
      and customer_id = v_user
      and source = 'online'
      and status = 'awaiting_payment'
      and payment_submitted_at is null
  ) then
    raise exception 'This hold can no longer be cancelled.';
  end if;

  update public.event_seats seat
  set status = 'available'
  from public.reservation_items item
  where item.reservation_id = p_reservation_id
    and item.released_at is null
    and item.seat_id = seat.id
    and seat.status = 'locked';

  update public.reservation_items
  set released_at = now()
  where reservation_id = p_reservation_id
    and released_at is null;

  update public.reservations
  set status = 'cancelled'
  where id = p_reservation_id;
end;
$$;

comment on function public.cancel_online_reservation(uuid) is
  'Cancels the signed-in customer''s unpaid online hold and releases its seats.';

revoke all on function public.release_expired_seat_holds() from public;
grant execute on function public.release_expired_seat_holds() to anon, authenticated;

revoke all on function public.create_online_reservation(uuid, uuid[]) from public, anon;
grant execute on function public.create_online_reservation(uuid, uuid[]) to authenticated;

revoke all on function public.cancel_online_reservation(uuid) from public, anon;
grant execute on function public.cancel_online_reservation(uuid) to authenticated;

revoke all on function public.touch_reservation_updated_at() from public, anon, authenticated;

alter table public.reservation_settings enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;

revoke all on table public.reservation_settings from anon, authenticated;
revoke all on table public.reservations from anon, authenticated;
revoke all on table public.reservation_items from anon, authenticated;

grant select on table public.reservations to authenticated;
grant select on table public.reservation_items to authenticated;

-- Customers read their own rows. Managers can read rows, but this phase has no staff booking page.
-- There is no insert, update, or delete policy. The functions above are the only writers.
create policy reservations_select_visible
  on public.reservations
  for select
  to authenticated
  using (customer_id = auth.uid() or public.is_event_manager());

create policy reservation_items_select_visible
  on public.reservation_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.reservations reservation
      where reservation.id = reservation_id
        and (reservation.customer_id = auth.uid() or public.is_event_manager())
    )
  );
