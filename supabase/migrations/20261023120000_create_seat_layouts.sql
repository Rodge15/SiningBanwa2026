-- Phase 5: visual seat layouts.
-- This file only adds new tables and functions. It does not change or delete events or accounts.
-- Run it once in the Supabase SQL Editor after the Phase 2 and Phase 3 migrations.
-- Open SQL Editor, paste this whole file, and click Run.
-- If the project is linked, `supabase db push` from this folder also works.

-- A section is one block of seats, such as Orchestra or Balcony, with one default price.
create table public.event_sections (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete restrict,
  name text not null,
  default_price numeric(10, 2) not null,
  sort_order integer not null,
  column_count integer not null,
  created_at timestamptz not null default now(),
  constraint event_sections_name_length check (char_length(name) between 2 and 60),
  constraint event_sections_price_range check (default_price >= 0 and default_price <= 999999.99),
  constraint event_sections_sort_order check (sort_order >= 0),
  constraint event_sections_column_count check (column_count between 1 and 40)
);

comment on table public.event_sections is
  'Seating sections for one event. The default price applies unless a seat has its own price.';

comment on column public.event_sections.default_price is
  'Section price in Philippine pesos.';

-- A row is one horizontal line of boxes inside a section. Empty boxes are not stored as seats.
create table public.event_rows (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete restrict,
  section_id uuid not null references public.event_sections (id) on delete restrict,
  label text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint event_rows_label_length check (char_length(label) between 1 and 40),
  constraint event_rows_sort_order check (sort_order >= 0),
  constraint event_rows_position_unique unique (section_id, sort_order)
);

comment on table public.event_rows is
  'Rows inside a section. sort_order is the row position in the grid.';

-- One seat is one box that can be booked later. This phase does not create reservations.
create table public.event_seats (
  id uuid primary key,
  event_id uuid not null references public.events (id) on delete restrict,
  section_id uuid not null references public.event_sections (id) on delete restrict,
  row_id uuid not null references public.event_rows (id) on delete restrict,
  label text not null,
  row_index integer not null,
  col_index integer not null,
  price_override numeric(10, 2),
  status text not null default 'available',
  created_at timestamptz not null default now(),
  constraint event_seats_label_length check (char_length(label) between 1 and 40),
  constraint event_seats_row_index check (row_index >= 0),
  constraint event_seats_col_index check (col_index >= 0 and col_index < 40),
  constraint event_seats_price_range check (
    price_override is null or (price_override >= 0 and price_override <= 999999.99)
  ),
  constraint event_seats_status_check check (
    status in ('available', 'locked', 'reserved', 'sold', 'blocked')
  ),
  constraint event_seats_box_unique unique (row_id, col_index)
);

comment on table public.event_seats is
  'Seat label, box position, optional price, and status. locked is reserved for a later hold phase.';

comment on column public.event_seats.price_override is
  'Null means use the section default price. A number is this seat only, in Philippine pesos.';

comment on column public.event_seats.status is
  'available, blocked, reserved (awaiting payment), sold (paid), or locked (on hold).';

create unique index event_sections_name_idx
  on public.event_sections (event_id, lower(name));

create unique index event_rows_label_idx
  on public.event_rows (section_id, lower(label));

create unique index event_seats_label_idx
  on public.event_seats (event_id, lower(label));

create index event_sections_event_idx
  on public.event_sections (event_id, sort_order);

create index event_rows_event_idx
  on public.event_rows (event_id, sort_order);

create index event_seats_event_idx
  on public.event_seats (event_id);

-- Internal readers for save_event_layout. The app cannot call these directly.
create or replace function public.seat_layout_sections(p_layout jsonb)
returns table (
  id uuid,
  name text,
  default_price numeric,
  sort_order integer,
  column_count integer
)
language sql
immutable
set search_path = public
as $$
  select
    (item ->> 'id')::uuid,
    btrim(item ->> 'name'),
    (item ->> 'defaultPrice')::numeric,
    (item ->> 'sortOrder')::integer,
    (item ->> 'columnCount')::integer
  from jsonb_array_elements(p_layout -> 'sections') item;
$$;

create or replace function public.seat_layout_rows(p_layout jsonb)
returns table (
  id uuid,
  section_id uuid,
  label text,
  sort_order integer
)
language sql
immutable
set search_path = public
as $$
  select
    (row_item ->> 'id')::uuid,
    (section_item ->> 'id')::uuid,
    btrim(row_item ->> 'label'),
    (row_item ->> 'sortOrder')::integer
  from jsonb_array_elements(p_layout -> 'sections') section_item
  cross join lateral jsonb_array_elements(section_item -> 'rows') row_item;
$$;

create or replace function public.seat_layout_seats(p_layout jsonb)
returns table (
  id uuid,
  section_id uuid,
  row_id uuid,
  label text,
  col_index integer,
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

-- Check and save happen in this one function, so a booked seat cannot be half-changed.
create or replace function public.save_event_layout(p_event_id uuid, p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  section_rec record;
  row_rec record;
  seat_rec record;
  section_count integer := 0;
  row_count integer := 0;
  seat_count integer := 0;
  section_ids uuid[] := '{}';
  section_names text[] := '{}';
  row_ids uuid[] := '{}';
  seat_ids uuid[] := '{}';
  seat_labels text[] := '{}';
  row_labels text[];
  row_positions integer[];
  v_id uuid;
  v_name text;
  v_label text;
  v_price numeric;
  v_columns integer;
  v_sort integer;
  v_col integer;
begin
  if not public.is_event_manager() then
    raise exception 'Only an active administrator or staff member can save a seat layout.';
  end if;

  if p_layout is null or jsonb_typeof(p_layout) <> 'object' or jsonb_typeof(p_layout -> 'sections') <> 'array' then
    raise exception 'Seat layout must include a sections list.';
  end if;

  if jsonb_array_length(p_layout -> 'sections') > 12 then
    raise exception 'A layout can have at most 12 sections.';
  end if;

  perform 1
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'That event could not be found.';
  end if;

  for section_rec in
    select value, ordinality
    from jsonb_array_elements(p_layout -> 'sections') with ordinality
  loop
    section_count := section_count + 1;
    row_count := 0;
    row_labels := '{}';
    row_positions := '{}';

    if section_rec.value ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Each section needs a valid id.';
    end if;

    v_id := (section_rec.value ->> 'id')::uuid;
    v_name := btrim(section_rec.value ->> 'name');

    if v_id = any (section_ids) then
      raise exception 'Each section id must be unique.';
    end if;

    if v_name is null
      or char_length(v_name) < 2
      or char_length(v_name) > 60
      or v_name ~ '[[:cntrl:]]'
      or left(v_name, 1) = '_' then
      raise exception 'Section name must be 2 to 60 characters.';
    end if;

    if lower(v_name) = any (section_names) then
      raise exception 'Section names must be unique in the event.';
    end if;

    if section_rec.value ->> 'defaultPrice' !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'Section price must be from 0 to 999999.99, with at most 2 decimal places.';
    end if;

    v_price := (section_rec.value ->> 'defaultPrice')::numeric;

    if v_price < 0 or v_price > 999999.99 then
      raise exception 'Section price must be from 0 to 999999.99, with at most 2 decimal places.';
    end if;

    if section_rec.value ->> 'columnCount' !~ '^[0-9]+$'
      or section_rec.value ->> 'sortOrder' !~ '^[0-9]+$' then
      raise exception 'Section position and column count must be whole numbers.';
    end if;

    v_columns := (section_rec.value ->> 'columnCount')::integer;
    v_sort := (section_rec.value ->> 'sortOrder')::integer;

    if v_columns < 1 or v_columns > 40 then
      raise exception 'Each section needs 1 to 40 columns.';
    end if;

    if jsonb_typeof(section_rec.value -> 'rows') <> 'array' then
      raise exception 'Each section needs a rows list.';
    end if;

    if jsonb_array_length(section_rec.value -> 'rows') < 1
      or jsonb_array_length(section_rec.value -> 'rows') > 40 then
      raise exception 'Each section needs 1 to 40 rows.';
    end if;

    section_ids := array_append(section_ids, v_id);
    section_names := array_append(section_names, lower(v_name));

    for row_rec in
      select value, ordinality
      from jsonb_array_elements(section_rec.value -> 'rows') with ordinality
    loop
      row_count := row_count + 1;

      if row_rec.value ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'Each row needs a valid id.';
      end if;

      v_id := (row_rec.value ->> 'id')::uuid;
      v_label := btrim(row_rec.value ->> 'label');

      if v_id = any (row_ids) then
        raise exception 'Each row id must be unique.';
      end if;

      if v_label is null
        or v_label !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,7}$'
        or left(v_label, 1) = '_' then
        raise exception 'Row label must be 1 to 8 letters, numbers, or hyphens.';
      end if;

      if lower(v_label) = any (row_labels) then
        raise exception 'Row labels must be unique inside a section.';
      end if;

      if row_rec.value ->> 'sortOrder' !~ '^[0-9]+$' then
        raise exception 'Row position must be a whole number.';
      end if;

      v_sort := (row_rec.value ->> 'sortOrder')::integer;

      if v_sort = any (row_positions) then
        raise exception 'Two rows cannot share the same position.';
      end if;

      if jsonb_typeof(row_rec.value -> 'seats') <> 'array' then
        raise exception 'Each row needs a seats list.';
      end if;

      row_ids := array_append(row_ids, v_id);
      row_labels := array_append(row_labels, lower(v_label));
      row_positions := array_append(row_positions, v_sort);

      for seat_rec in
        select value
        from jsonb_array_elements(row_rec.value -> 'seats')
      loop
        seat_count := seat_count + 1;

        if seat_count > 2000 then
          raise exception 'A layout can have at most 2000 seats.';
        end if;

        if seat_rec.value ->> 'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          raise exception 'Each seat needs a valid id.';
        end if;

        v_id := (seat_rec.value ->> 'id')::uuid;
        v_label := btrim(seat_rec.value ->> 'label');

        if v_id = any (seat_ids) then
          raise exception 'Each seat id must be unique.';
        end if;

        if v_label is null
          or v_label !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,19}$'
          or left(v_label, 1) = '_' then
          raise exception 'Seat label must be 1 to 20 letters, numbers, or hyphens.';
        end if;

        if lower(v_label) = any (seat_labels) then
          raise exception 'Each seat label must be unique in the event.';
        end if;

        if seat_rec.value ->> 'colIndex' !~ '^[0-9]+$' then
          raise exception 'Seat column must be a whole number.';
        end if;

        v_col := (seat_rec.value ->> 'colIndex')::integer;

        if v_col < 0 or v_col >= v_columns then
          raise exception 'A seat is outside its row.';
        end if;

        if seat_rec.value ->> 'status' not in ('available', 'blocked', 'reserved', 'sold', 'locked') then
          raise exception 'Unknown seat status.';
        end if;

        if seat_rec.value ->> 'priceOverride' is not null
          and seat_rec.value ->> 'priceOverride' !~ '^[0-9]+(\.[0-9]{1,2})?$' then
          raise exception 'Seat price must be from 0 to 999999.99, with at most 2 decimal places.';
        end if;

        if seat_rec.value ->> 'priceOverride' is not null then
          v_price := (seat_rec.value ->> 'priceOverride')::numeric;

          if v_price < 0 or v_price > 999999.99 then
            raise exception 'Seat price must be from 0 to 999999.99, with at most 2 decimal places.';
          end if;
        end if;

        seat_ids := array_append(seat_ids, v_id);
        seat_labels := array_append(seat_labels, lower(v_label));
      end loop;
    end loop;
  end loop;

  if exists (
    select 1
    from public.event_sections existing
    join public.seat_layout_sections(p_layout) incoming on incoming.id = existing.id
    where existing.event_id <> p_event_id
  ) or exists (
    select 1
    from public.event_rows existing
    join public.seat_layout_rows(p_layout) incoming on incoming.id = existing.id
    where existing.event_id <> p_event_id
  ) or exists (
    select 1
    from public.event_seats existing
    join public.seat_layout_seats(p_layout) incoming on incoming.id = existing.id
    where existing.event_id <> p_event_id
  ) then
    raise exception 'A layout id belongs to another event.';
  end if;

  -- Reserved, sold, and on-hold seats are the confirmed boxes. Do not damage them.
  if exists (
    select 1
    from public.event_seats seat
    join public.event_rows old_row on old_row.id = seat.row_id
    join public.event_sections old_section on old_section.id = seat.section_id
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
        or incoming.status is distinct from seat.status
        or new_row.sort_order is distinct from seat.row_index
        or new_row.label is distinct from old_row.label
        or coalesce(incoming.price_override, new_section.default_price)
          is distinct from coalesce(seat.price_override, old_section.default_price)
      )
  ) then
    raise exception 'A reserved, sold, or on-hold seat cannot be removed or changed.';
  end if;

  if exists (
    select 1
    from public.seat_layout_seats(p_layout) incoming
    left join public.event_seats seat
      on seat.id = incoming.id
      and seat.event_id = p_event_id
    where incoming.status = 'locked'
      and (seat.id is null or seat.status is distinct from 'locked')
  ) then
    raise exception 'The designer cannot put a seat on hold.';
  end if;

  -- Copy the current section price onto a protected seat before the section price can change.
  update public.event_seats seat
  set price_override = coalesce(seat.price_override, section.default_price)
  from public.event_sections section
  where seat.event_id = p_event_id
    and section.id = seat.section_id
    and seat.status in ('reserved', 'sold', 'locked')
    and seat.price_override is null;

  -- Free the old names first so a renamed section does not collide during the save.
  update public.event_sections
  set name = '_' || id::text
  where event_id = p_event_id;

  update public.event_rows
  set label = '_' || id::text
  where event_id = p_event_id;

  update public.event_seats
  set label = '_' || id::text
  where event_id = p_event_id;

  insert into public.event_sections (id, event_id, name, default_price, sort_order, column_count)
  select id, p_event_id, name, default_price, sort_order, column_count
  from public.seat_layout_sections(p_layout)
  on conflict (id) do update
  set
    name = excluded.name,
    default_price = excluded.default_price,
    sort_order = excluded.sort_order,
    column_count = excluded.column_count
  where public.event_sections.event_id = p_event_id;

  insert into public.event_rows (id, event_id, section_id, label, sort_order)
  select id, p_event_id, section_id, label, sort_order
  from public.seat_layout_rows(p_layout)
  on conflict (id) do update
  set
    section_id = excluded.section_id,
    label = excluded.label,
    sort_order = excluded.sort_order
  where public.event_rows.event_id = p_event_id;

  insert into public.event_seats (
    id,
    event_id,
    section_id,
    row_id,
    label,
    row_index,
    col_index,
    price_override,
    status
  )
  select
    incoming.id,
    p_event_id,
    incoming.section_id,
    incoming.row_id,
    incoming.label,
    new_row.sort_order,
    incoming.col_index,
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

comment on function public.save_event_layout(uuid, jsonb) is
  'Saves one event layout in a single transaction and refuses changes to reserved, sold, or on-hold seats.';

revoke all on function public.save_event_layout(uuid, jsonb) from public, anon;
grant execute on function public.save_event_layout(uuid, jsonb) to authenticated;

alter table public.event_sections enable row level security;
alter table public.event_rows enable row level security;
alter table public.event_seats enable row level security;

revoke all on table public.event_sections from anon, authenticated;
revoke all on table public.event_rows from anon, authenticated;
revoke all on table public.event_seats from anon, authenticated;

grant select on table public.event_sections to anon, authenticated;
grant select on table public.event_rows to anon, authenticated;
grant select on table public.event_seats to anon, authenticated;

-- Guests can read a layout only when the event is published. Managers can read every layout.
-- There is no insert, update, or delete policy. The save function is the only writer.
create policy event_sections_select_visible
  on public.event_sections
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.events event
      where event.id = event_id
        and (event.status = 'published' or public.is_event_manager())
    )
  );

create policy event_rows_select_visible
  on public.event_rows
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.events event
      where event.id = event_id
        and (event.status = 'published' or public.is_event_manager())
    )
  );

create policy event_seats_select_visible
  on public.event_seats
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.events event
      where event.id = event_id
        and (event.status = 'published' or public.is_event_manager())
    )
  );
