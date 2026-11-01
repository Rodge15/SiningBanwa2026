-- Phase 5 fix: tiers, drag positions, seated or general admission, and audience capacity.
-- This file only adds missing columns and replaces save functions. It does not drop tables.
-- Run it in the Supabase SQL Editor after 20261025120000_create_reservations.sql.
-- If an earlier run stopped with "column already exists", paste this updated file and run it again.
-- It skips columns and checks that are already there.
-- If the project is linked, `supabase db push` from this folder also works.

alter table public.events
  add column if not exists admission_type text not null default 'seated',
  add column if not exists audience_capacity integer,
  add column if not exists ticket_price numeric(10, 2);

update public.events
set audience_capacity = greatest(
  coalesce((select count(*) from public.event_seats where event_seats.event_id = events.id), 0),
  1
)
where audience_capacity is null;

alter table public.events
  alter column audience_capacity set not null,
  alter column audience_capacity set default 1;

alter table public.events drop constraint if exists events_admission_type_check;
alter table public.events drop constraint if exists events_audience_capacity_check;
alter table public.events drop constraint if exists events_ticket_price_check;
alter table public.events drop constraint if exists events_general_price_check;

alter table public.events
  add constraint events_admission_type_check check (admission_type in ('seated', 'general')),
  add constraint events_audience_capacity_check check (audience_capacity between 1 and 2000),
  add constraint events_ticket_price_check check (
    ticket_price is null or (ticket_price >= 0 and ticket_price <= 999999.99)
  ),
  add constraint events_general_price_check check (
    admission_type <> 'general' or ticket_price is not null
  );

comment on column public.events.admission_type is
  'seated uses the seat map. general has no seat map and sells a ticket count.';

comment on column public.events.audience_capacity is
  'Total audience for this show. Seated layouts cannot save more seats than this.';

comment on column public.events.ticket_price is
  'Required for general admission. Seated prices live on the section or row.';

alter table public.event_sections
  add column if not exists tier text not null default 'regular',
  add column if not exists pos_x integer not null default 40,
  add column if not exists pos_y integer not null default 40;

alter table public.event_sections drop constraint if exists event_sections_tier_check;
alter table public.event_sections drop constraint if exists event_sections_pos_check;

alter table public.event_sections
  add constraint event_sections_tier_check check (tier in ('regular', 'semi_vip', 'vip')),
  add constraint event_sections_pos_check check (pos_x between 0 and 4000 and pos_y between 0 and 4000);

alter table public.event_rows
  add column if not exists tier text not null default 'regular',
  add column if not exists price numeric(10, 2),
  add column if not exists pos_x integer not null default 16,
  add column if not exists pos_y integer not null default 48;

update public.event_rows event_row
set price = section.default_price
from public.event_sections section
where section.id = event_row.section_id
  and event_row.price is null;

alter table public.event_rows
  alter column price set not null;

alter table public.event_rows drop constraint if exists event_rows_tier_check;
alter table public.event_rows drop constraint if exists event_rows_price_check;
alter table public.event_rows drop constraint if exists event_rows_pos_check;

alter table public.event_rows
  add constraint event_rows_tier_check check (tier in ('regular', 'semi_vip', 'vip')),
  add constraint event_rows_price_check check (price >= 0 and price <= 999999.99),
  add constraint event_rows_pos_check check (pos_x between 0 and 4000 and pos_y between 0 and 4000);

alter table public.event_seats
  drop constraint if exists event_seats_col_index;

alter table public.event_seats
  add constraint event_seats_col_index check (col_index >= 0 and col_index < 200);

alter table public.event_seats
  add column if not exists pos_x integer not null default 0,
  add column if not exists pos_y integer not null default 0;

alter table public.event_seats drop constraint if exists event_seats_pos_check;

alter table public.event_seats
  add constraint event_seats_pos_check check (pos_x between 0 and 4000 and pos_y between 0 and 4000);

update public.event_sections
set pos_x = 40,
    pos_y = 40 + sort_order * 220;

update public.event_rows event_row
set pos_x = section.pos_x + 16,
    pos_y = section.pos_y + 48 + event_row.sort_order * 72
from public.event_sections section
where section.id = event_row.section_id;

update public.event_seats seat
set pos_x = event_row.pos_x + seat.col_index * 92,
    pos_y = event_row.pos_y + 28
from public.event_rows event_row
where event_row.id = seat.row_id;

comment on column public.event_sections.tier is
  'regular, semi_vip, or vip. The same colors are shown to staff and customers.';

comment on column public.event_rows.price is
  'Row price in Philippine pesos. This can differ from the section price.';

comment on column public.event_seats.pos_x is
  'Saved canvas position. A reserved, sold, or on-hold seat cannot be moved.';

alter table public.reservations
  add column if not exists ticket_quantity integer not null default 0;

alter table public.reservations drop constraint if exists reservations_ticket_quantity_check;

alter table public.reservations
  add constraint reservations_ticket_quantity_check check (ticket_quantity between 0 and 2000);

comment on column public.reservations.ticket_quantity is
  'General admission ticket count. Seated holds keep this at 0 and use reservation items.';

drop function if exists public.save_event_layout(uuid, jsonb);
drop function if exists public.seat_layout_sections(jsonb);
drop function if exists public.seat_layout_rows(jsonb);
drop function if exists public.seat_layout_seats(jsonb);

create function public.seat_layout_sections(p_layout jsonb)
returns table (
  id uuid,
  name text,
  default_price numeric,
  tier text,
  sort_order integer,
  column_count integer,
  pos_x integer,
  pos_y integer
)
language sql
immutable
set search_path = public
as $$
  select
    (item ->> 'id')::uuid,
    btrim(item ->> 'name'),
    (item ->> 'defaultPrice')::numeric,
    item ->> 'tier',
    (item ->> 'sortOrder')::integer,
    (item ->> 'columnCount')::integer,
    (item ->> 'posX')::integer,
    (item ->> 'posY')::integer
  from jsonb_array_elements(p_layout -> 'sections') item;
$$;

create function public.seat_layout_rows(p_layout jsonb)
returns table (
  id uuid,
  section_id uuid,
  label text,
  tier text,
  price numeric,
  sort_order integer,
  pos_x integer,
  pos_y integer
)
language sql
immutable
set search_path = public
as $$
  select
    (row_item ->> 'id')::uuid,
    (section_item ->> 'id')::uuid,
    btrim(row_item ->> 'label'),
    row_item ->> 'tier',
    (row_item ->> 'price')::numeric,
    (row_item ->> 'sortOrder')::integer,
    (row_item ->> 'posX')::integer,
    (row_item ->> 'posY')::integer
  from jsonb_array_elements(p_layout -> 'sections') section_item
  cross join lateral jsonb_array_elements(section_item -> 'rows') row_item;
$$;

create function public.seat_layout_seats(p_layout jsonb)
returns table (
  id uuid,
  section_id uuid,
  row_id uuid,
  label text,
  col_index integer,
  pos_x integer,
  pos_y integer,
  price_override numeric,
  status text
)
language sql
immutable
set search_path = public
as $$
  select
    (seat_item ->> 'id')::uuid,
    (section_item ->> 'id')::uuid,
    (row_item ->> 'id')::uuid,
    btrim(seat_item ->> 'label'),
    (seat_item ->> 'colIndex')::integer,
    (seat_item ->> 'posX')::integer,
    (seat_item ->> 'posY')::integer,
    case
      when seat_item ->> 'priceOverride' is null then null
      else (seat_item ->> 'priceOverride')::numeric
    end,
    seat_item ->> 'status'
  from jsonb_array_elements(p_layout -> 'sections') section_item
  cross join lateral jsonb_array_elements(section_item -> 'rows') row_item
  cross join lateral jsonb_array_elements(coalesce(row_item -> 'seats', '[]'::jsonb)) seat_item;
$$;

revoke all on function public.seat_layout_sections(jsonb) from public, anon, authenticated;
revoke all on function public.seat_layout_rows(jsonb) from public, anon, authenticated;
revoke all on function public.seat_layout_seats(jsonb) from public, anon, authenticated;

create function public.save_event_layout(p_event_id uuid, p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_type text;
  v_seat_count integer;
begin
  if not public.is_event_manager() then
    raise exception 'Only an administrator or staff member can save a seat layout.';
  end if;

  select admission_type, audience_capacity
  into v_type, v_capacity
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

  select count(*)
  into v_seat_count
  from public.seat_layout_seats(p_layout);

  if v_seat_count > v_capacity then
    raise exception 'The layout has more seats than the audience capacity.';
  end if;

  if exists (
    select 1
    from public.seat_layout_sections(p_layout)
    where tier not in ('regular', 'semi_vip', 'vip')
      or pos_x < 0 or pos_x > 4000
      or pos_y < 0 or pos_y > 4000
      or default_price < 0 or default_price > 999999.99
  ) or exists (
    select 1
    from public.seat_layout_rows(p_layout)
    where tier not in ('regular', 'semi_vip', 'vip')
      or price < 0 or price > 999999.99
      or pos_x < 0 or pos_x > 4000
      or pos_y < 0 or pos_y > 4000
  ) or exists (
    select 1
    from public.seat_layout_seats(p_layout)
    where pos_x < 0 or pos_x > 4000
      or pos_y < 0 or pos_y > 4000
      or status not in ('available', 'blocked', 'reserved', 'sold', 'locked')
  ) then
    raise exception 'A section, row, or seat has an invalid tier, price, position, or status.';
  end if;

  if exists (
    select 1
    from public.event_seats seat
    left join public.seat_layout_seats(p_layout) incoming on incoming.id = seat.id
    left join public.seat_layout_rows(p_layout) new_row on new_row.id = incoming.row_id
    left join public.seat_layout_sections(p_layout) new_section on new_section.id = incoming.section_id
    where seat.event_id = p_event_id
      and seat.status in ('reserved', 'sold', 'locked')
      and (
        incoming.id is null
        or incoming.label is distinct from seat.label
        or incoming.section_id is distinct from seat.section_id
        or incoming.row_id is distinct from seat.row_id
        or incoming.col_index is distinct from seat.col_index
        or incoming.pos_x is distinct from seat.pos_x
        or incoming.pos_y is distinct from seat.pos_y
        or incoming.status is distinct from seat.status
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

  update public.event_seats seat
  set price_override = coalesce(seat.price_override, event_row.price, section.default_price)
  from public.event_rows event_row
  join public.event_sections section on section.id = event_row.section_id
  where seat.event_id = p_event_id
    and event_row.id = seat.row_id
    and seat.status in ('reserved', 'sold', 'locked')
    and seat.price_override is null;

  update public.event_rows event_row
  set sort_order = numbered.n
  from (
    select id, 10000 + row_number() over (partition by section_id order by id) as n
    from public.event_rows
    where event_id = p_event_id
  ) numbered
  where event_row.id = numbered.id;

  update public.event_seats seat
  set col_index = numbered.n
  from (
    select id, 100 + row_number() over (partition by row_id order by id) as n
    from public.event_seats
    where event_id = p_event_id
  ) numbered
  where seat.id = numbered.id;

  update public.event_sections
  set name = '_' || id::text
  where event_id = p_event_id;

  update public.event_rows
  set label = '_' || id::text
  where event_id = p_event_id;

  update public.event_seats
  set label = '_' || id::text
  where event_id = p_event_id;

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
      when seat.status in ('reserved', 'sold', 'locked') then seat.price_override
      else incoming.price_override
    end,
    incoming.status
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

  delete from public.event_seats
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_seats(p_layout));

  delete from public.event_rows
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_rows(p_layout));

  delete from public.event_sections
  where event_id = p_event_id
    and id not in (select id from public.seat_layout_sections(p_layout));
end;
$$;

revoke all on function public.save_event_layout(uuid, jsonb) from public, anon;
grant execute on function public.save_event_layout(uuid, jsonb) to authenticated;

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
  v_general integer := 0;
begin
  update public.reservations
  set status = 'expired'
  where status = 'awaiting_payment'
    and payment_submitted_at is null
    and hold_expires_at <= now()
    and ticket_quantity > 0
    and not exists (
      select 1
      from public.reservation_items item
      where item.reservation_id = reservations.id
        and item.released_at is null
    );

  get diagnostics v_general = row_count;

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
    return v_general;
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
  return v_count + v_general;
end;
$$;

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
  v_total numeric(10, 2);
  v_reservation_id uuid := gen_random_uuid();
  v_found integer;
  v_updated integer;
begin
  if v_user is null then
    raise exception 'Log in before reserving seats.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user and role = 'customer' and is_active
  ) then
    raise exception 'Only an active customer can reserve seats.';
  end if;

  if p_seat_ids is null or cardinality(p_seat_ids) < 1 then
    raise exception 'Select at least one seat.';
  end if;

  if cardinality(p_seat_ids) > 10 then
    raise exception 'You can reserve at most 10 seats at a time.';
  end if;

  perform public.release_expired_seat_holds();

  select title, admission_type
  into v_title, v_type
  from public.events
  where id = p_event_id
    and status = 'published';

  if v_title is null then
    raise exception 'That event is not open for reservations.';
  end if;

  if v_type <> 'seated' then
    raise exception 'This show sells tickets, not specific seats.';
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
    id, event_id, customer_id, status, total_amount, source, created_by, event_title, hold_expires_at, ticket_quantity
  )
  values (
    v_reservation_id, p_event_id, v_user, 'awaiting_payment', v_total, 'online', v_user, v_title,
    now() + make_interval(mins => v_hold_minutes), 0
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
  v_taken integer;
  v_reservation_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'Log in before reserving tickets.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user and role = 'customer' and is_active
  ) then
    raise exception 'Only an active customer can reserve tickets.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'Choose 1 to 10 tickets.';
  end if;

  perform public.release_expired_seat_holds();

  select title, audience_capacity, ticket_price
  into v_title, v_capacity, v_price
  from public.events
  where id = p_event_id
    and status = 'published'
    and admission_type = 'general'
  for update;

  if v_title is null or v_price is null then
    raise exception 'That show is not open for general admission.';
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
    hold_expires_at, ticket_quantity
  )
  values (
    v_reservation_id, p_event_id, v_user, 'awaiting_payment', v_price * p_quantity, 'online', v_user,
    v_title, now() + make_interval(mins => v_hold_minutes), p_quantity
  );

  return v_reservation_id;
end;
$$;

revoke all on function public.create_general_admission_reservation(uuid, integer) from public, anon;
grant execute on function public.create_general_admission_reservation(uuid, integer) to authenticated;

comment on function public.create_general_admission_reservation(uuid, integer) is
  'Holds a ticket count for a general admission show. The price comes from the event, not the browser.';
