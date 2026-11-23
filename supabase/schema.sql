-- Reisplanner: database-schema voor Supabase.
-- Plak dit in Supabase → SQL Editor → New query, en klik Run.

create table if not exists public.trips (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists trips_owner_idx on public.trips (owner, updated_at desc);

alter table public.trips enable row level security;

-- Iedereen ziet en bewerkt alleen zijn eigen reizen.
drop policy if exists "trips_select_own" on public.trips;
create policy "trips_select_own" on public.trips for select using (auth.uid() = owner);

drop policy if exists "trips_insert_own" on public.trips;
create policy "trips_insert_own" on public.trips for insert with check (auth.uid() = owner);

drop policy if exists "trips_update_own" on public.trips;
create policy "trips_update_own" on public.trips for update using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "trips_delete_own" on public.trips;
create policy "trips_delete_own" on public.trips for delete using (auth.uid() = owner);
