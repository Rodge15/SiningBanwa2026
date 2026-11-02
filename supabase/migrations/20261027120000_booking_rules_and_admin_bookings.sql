-- Phase 6 gap and Phase 7: online time window, plus admin and walk-in sales.
-- This is a NEW file. It does not edit older migrations, and it does not drop tables.
-- Run it once in the Supabase SQL Editor after 20261026120000_seat_tiers_and_admission.sql.
-- If a line says the object already exists, paste this updated file and run it again.

-- Guest walk-ins may have no login, so the customer account can be empty.
-- The name is still stored on the booking so staff can read the record.
alter table public.reservations
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists created_by_name text;

alter table public.reservations
  alter column customer_id drop not null;

update public.reservations reservation
set
  customer_name = case
    when char_length(btrim(coalesce(profile.full_name, ''))) >= 2 then left(btrim(profile.full_name), 120)
    when char_length(coalesce(profile.email, '')) >= 2 then left(profile.email, 120)
    else 'Customer'
  end,
  customer_phone = profile.phone,
  customer_email = nullif(profile.email, '')
from public.profiles profile
where reservation.customer_id = profile.id
  and reservation.customer_name is null;

update public.reservations reservation
set created_by_name = case
  when char_length(btrim(coalesce(profile.full_name, ''))) >= 2 then left(btrim(profile.full_name), 120)
  when char_length(coalesce(profile.email, '')) >= 2 then left(profile.email, 120)
  else 'Staff'
end
from public.profiles profile
where reservation.created_by = profile.id
  and reservation.created_by_name is null;

alter table public.reservations drop constraint if exists reservations_source_check;
alter table public.reservations
  add constraint reservations_source_check
  check (source in ('online', 'admin', 'walk_in'));

alter table public.reservations drop constraint if exists reservations_customer_name_length;
alter table public.reservations
  add constraint reservations_customer_name_length
  check (customer_name is null or char_length(btrim(customer_name)) between 2 and 120);

alter table public.reservations drop constraint if exists reservations_customer_present;
alter table public.reservations
  add constraint reservations_customer_present
  check (customer_id is not null or char_length(btrim(coalesce(customer_name, ''))) >= 2);

comment on column public.reservations.source is
  'online, admin, or walk_in. Admin and walk-in sales are marked sold immediately.';

comment on column public.reservations.customer_name is
  'Name copied at booking time so staff can see a walk-in who has no account.';

-- Shared clock for online booking. Phase 8 payment submission must call this too.
-- Open from 8:00 AM until 8:00 PM, Asia/Manila, and not within 3 hours of the start.
create or replace function public.online_sales_closed_reason(p_starts_at timestamptz)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_local timestamp;
  v_minutes integer;
begin
  if p_starts_at is null then
    return 'This show has no start time.';
  end if;

  if now() >= p_starts_at then
    return 'Online booking is closed because the show has started.';
  end if;

  if now() >= p_starts_at - interval '3 hours' then
    return 'Online booking closes 3 hours before the show starts.';
  end if;

  v_local := now() at time zone 'Asia/Manila';
  v_minutes := (extract(hour from v_local)::integer * 60) + extract(minute from v_local)::integer;

  if v_minutes < 8 * 60 or v_minutes >= 20 * 60 then
    return 'Online booking is open only from 8:00 AM to 8:00 PM.';
  end if;

  return null;
end;
$$;

revoke all on function public.online_sales_closed_reason(timestamptz) from public, anon;
grant execute on function public.online_sales_closed_reason(timestamptz) to authenticated;

-- Ticket counts for the public remaining label. No customer names are returned.
create or replace function public.event_ticket_counts(p_event_ids uuid[])
returns table (event_id uuid, ticket_quantity integer, status text)
language sql
stable
security definer
set search_path = public
as $$
  select reservation.event_id, reservation.ticket_quantity, reservation.status
  from public.reservations reservation
  join public.events event on event.id = reservation.event_id
  where reservation.event_id = any(p_event_ids)
    and reservation.ticket_quantity > 0
    and reservation.status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed')
    and (event.status = 'published' or public.is_event_manager());
$$;

revoke all on function public.event_ticket_counts(uuid[]) from public;
grant execute on function public.event_ticket_counts(uuid[]) to anon, authenticated;

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

  if p_seat_ids is null or cardinality(p_seat_ids) < 1 then
    raise exception 'Select at least one seat.';
  end if;

  if cardinality(p_seat_ids) > 10 then
    raise exception 'You can reserve at most 10 seats at a time.';
  end if;

  perform public.release_expired_seat_holds();

  select title, admission_type, starts_at
  into v_title, v_type, v_starts
  from public.events
  where id = p_event_id
    and status = 'published';

  if v_title is null then
    raise exception 'That event is not open for reservations.';
  end if;

  if v_type <> 'seated' then
    raise exception 'This show sells tickets, not specific seats.';
  end if;

  v_closed := public.online_sales_closed_reason(v_starts);

  if v_closed is not null then
    raise exception '%', v_closed;
  end if;

  select hold_minutes into v_hold_minutes
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

  select count(*) into v_found
  from public.event_seats
  where id = any(p_seat_ids)
    and event_id = p_event_id;

  if v_found <> cardinality(p_seat_ids) then
    raise exception 'One or more seats do not belong to this event.';
  end if;

  if exists (
    select 1 from public.event_seats
    where id = any(p_seat_ids)
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
    id, event_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, p_event_id, v_user, 'awaiting_payment', v_total, 'online', v_user, v_title,
    now() + make_interval(mins => v_hold_minutes), 0, v_name, v_phone, nullif(v_email, ''), v_name
  );

  insert into public.reservation_items (reservation_id, event_id, seat_id, seat_label, unit_price)
  select
    v_reservation_id,
    p_event_id,
    seat.id,
    seat.label,
    coalesce(seat.price_override, event_row.price, section.default_price)
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
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

create or replace function public.create_general_admission_reservation(p_event_id uuid, p_quantity integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hold_minutes integer;
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

  select title, audience_capacity, ticket_price, starts_at
  into v_title, v_capacity, v_price, v_starts
  from public.events
  where id = p_event_id
    and status = 'published'
    and admission_type = 'general'
  for update;

  if v_title is null or v_price is null then
    raise exception 'That show is not open for general admission.';
  end if;

  v_closed := public.online_sales_closed_reason(v_starts);

  if v_closed is not null then
    raise exception '%', v_closed;
  end if;

  select coalesce(sum(ticket_quantity), 0)
  into v_taken
  from public.reservations
  where event_id = p_event_id
    and ticket_quantity > 0
    and status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed');

  if v_taken + p_quantity > v_capacity then
    raise exception 'Not enough tickets are left.';
  end if;

  select hold_minutes into v_hold_minutes
  from public.reservation_settings
  where id = 1;

  if v_hold_minutes is null then
    v_hold_minutes := 5;
  end if;

  insert into public.reservations (
    id, event_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, p_event_id, v_user, 'awaiting_payment', v_price * p_quantity, 'online', v_user,
    v_title, now() + make_interval(mins => v_hold_minutes), p_quantity, v_name, v_phone, nullif(v_email, ''), v_name
  );

  return v_reservation_id;
end;
$$;

-- Staff lookup. Returns only active customer accounts, not every profile.
create or replace function public.search_booking_customers(p_query text)
returns table (id uuid, full_name text, email text, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_query text := left(btrim(coalesce(p_query, '')), 80);
begin
  if not public.is_event_manager() then
    raise exception 'Only staff can look up customers.';
  end if;

  v_query := replace(replace(v_query, '%', ''), '_', '');

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
  select profile.id, profile.full_name, profile.email, profile.phone
  from public.profiles profile
  where profile.role = 'customer'
    and profile.is_active
    and (
      profile.full_name ilike '%' || v_query || '%'
      or profile.email ilike '%' || v_query || '%'
      or coalesce(profile.phone, '') ilike '%' || v_query || '%'
    )
  order by profile.full_name nulls last, profile.email
  limit 20;
end;
$$;

revoke all on function public.search_booking_customers(text) from public, anon;
grant execute on function public.search_booking_customers(text) to authenticated;

-- Sells seats or tickets immediately. No five-minute hold and no online time window.
create or replace function public.create_staff_reservation(
  p_event_id uuid,
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
    where id = p_customer_id
      and role = 'customer'
      and is_active;

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

  select title, admission_type, status, audience_capacity, ticket_price
  into v_title, v_type, v_status, v_capacity, v_price
  from public.events
  where id = p_event_id
  for update;

  if v_title is null or v_status = 'cancelled' then
    raise exception 'That show cannot be booked.';
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
    where event_id = p_event_id
      and ticket_quantity > 0
      and status in ('pending', 'awaiting_payment', 'payment_verification', 'confirmed');

    if v_taken + p_quantity > v_capacity then
      raise exception 'Not enough tickets are left.';
    end if;

    insert into public.reservations (
      id, event_id, customer_id, status, total_amount, source, created_by, event_title,
      hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
    )
    values (
      v_reservation_id, p_event_id, p_customer_id, 'confirmed', v_price * p_quantity, p_source, v_user,
      v_title, null, p_quantity, v_name, v_phone, v_email, v_staff_name
    );

    return v_reservation_id;
  end if;

  if cardinality(v_seat_ids) < 1 then
    raise exception 'Select at least one seat.';
  end if;

  if cardinality(v_seat_ids) > 40 then
    raise exception 'You can sell at most 40 seats at a time.';
  end if;

  if exists (
    select 1
    from unnest(v_seat_ids) seat_id
    group by seat_id
    having count(*) > 1
  ) then
    raise exception 'Each seat can be selected only once.';
  end if;

  perform 1
  from public.event_seats
  where id = any(v_seat_ids)
    and event_id = p_event_id
  order by id
  for update;

  select count(*) into v_found
  from public.event_seats
  where id = any(v_seat_ids)
    and event_id = p_event_id;

  if v_found <> cardinality(v_seat_ids) then
    raise exception 'One or more seats do not belong to this event.';
  end if;

  if exists (
    select 1 from public.event_seats
    where id = any(v_seat_ids)
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
    id, event_id, customer_id, status, total_amount, source, created_by, event_title,
    hold_expires_at, ticket_quantity, customer_name, customer_phone, customer_email, created_by_name
  )
  values (
    v_reservation_id, p_event_id, p_customer_id, 'confirmed', v_total, p_source, v_user, v_title,
    null, 0, v_name, v_phone, v_email, v_staff_name
  );

  insert into public.reservation_items (reservation_id, event_id, seat_id, seat_label, unit_price)
  select
    v_reservation_id,
    p_event_id,
    seat.id,
    seat.label,
    coalesce(seat.price_override, event_row.price, section.default_price)
  from public.event_seats seat
  join public.event_sections section on section.id = seat.section_id
  join public.event_rows event_row on event_row.id = seat.row_id
  where seat.id = any(v_seat_ids);

  update public.event_seats
  set status = 'sold'
  where id = any(v_seat_ids)
    and event_id = p_event_id
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

comment on function public.create_staff_reservation(uuid, text, uuid, text, text, text, uuid[], integer) is
  'Staff sale. Seats become sold immediately. Admin and walk-in are not limited by the online clock.';
