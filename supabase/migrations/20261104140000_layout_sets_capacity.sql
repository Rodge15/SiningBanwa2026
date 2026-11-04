-- Seated layout save sets audience capacity to the number of designed seats.
-- This file does not drop tables.
--
-- Where to run it:
-- 1. Open the Supabase dashboard for this project.
-- 2. Go to SQL Editor, then New query.
-- 3. Paste this whole file.
-- 4. Run it once, after 20261104120000_showings_and_payments.sql.
-- 5. Refresh the app, then save the seat layout again.
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


