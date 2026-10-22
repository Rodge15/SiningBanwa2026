-- Phase 3: user profiles, roles, and account status.
-- This is a NEW file. It does not edit the Phase 2 migration, and it does not delete any data.
-- Run it yourself in the Supabase SQL editor after the Phase 2 migration has run.

-- One profile row per Supabase Auth user. Passwords stay in Supabase Auth, not here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text,
  phone text,
  role text not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('customer', 'administrator', 'staff', 'venue')),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 120),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 30)
);

comment on table public.profiles is
  'Account details, role, and status for each Supabase Auth user.';

create index profiles_role_idx on public.profiles (role);

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_profile_updated_at();

-- Every new sign-up gets a customer profile automatically.
-- Nobody can sign up as an administrator, staff, or venue account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Give a profile to every account that already exists.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  coalesce(u.email, ''),
  nullif(left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), 120), ''),
  'customer'
from auth.users u
on conflict (id) do nothing;

-- Carry over the Phase 2 managers so nobody loses access.
update public.profiles p
set role = m.role
from public.event_managers m
where p.id = m.user_id;

comment on table public.event_managers is
  'No longer used since Phase 3. Roles now live in public.profiles. Kept so no data is deleted.';

-- Helper used by Row Level Security. Guests have no user id, so this returns false for them.
create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'administrator'
      and is_active
  );
$$;

revoke all on function public.is_administrator() from public, anon;
grant execute on function public.is_administrator() to authenticated;

-- Phase 2 policies already call this function, so events now follow the profiles table.
-- Inactive accounts are not event managers.
create or replace function public.is_event_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('administrator', 'staff')
      and is_active
  );
$$;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;

grant select on table public.profiles to authenticated;
-- Only these two columns can be changed from the app. Role and status cannot.
grant update (full_name, phone) on table public.profiles to authenticated;

-- A user can read their own profile. An active administrator can read all profiles.
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy profiles_select_administrator
  on public.profiles
  for select
  to authenticated
  using (public.is_administrator());

-- A user can update only their own row, and only full_name and phone (see the grant above).
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and is_active)
  with check (id = auth.uid());

-- There is no insert or delete policy. The sign-up trigger creates rows.

-- Only an active administrator can change a role or switch an account on or off.
-- This is a function so the checks and the change happen together.
create or replace function public.set_profile_access(
  target_id uuid,
  new_role text,
  new_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_administrator() then
    raise exception 'Only an active administrator can change account access.';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot change your own role or status.';
  end if;

  if new_role not in ('customer', 'administrator', 'staff', 'venue') then
    raise exception 'Unknown role.';
  end if;

  update public.profiles
  set role = new_role,
      is_active = new_active
  where id = target_id;

  if not found then
    raise exception 'That account does not exist.';
  end if;
end;
$$;

revoke all on function public.set_profile_access(uuid, text, boolean) from public, anon;
grant execute on function public.set_profile_access(uuid, text, boolean) to authenticated;
