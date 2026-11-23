-- Verre: database-schema voor Supabase.
-- Plak dit in Supabase → SQL Editor → New query, en klik Run.
-- Je kunt het veilig opnieuw draaien: bestaande data blijft staan.

-- ============ Reizen ============

create table if not exists public.trips (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.trips add column if not exists owner_email text default (auth.jwt() ->> 'email');

create index if not exists trips_owner_idx on public.trips (owner, updated_at desc);

-- ============ Delen: medereizigers per reis ============

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (trip_id, email)
);

create index if not exists trip_members_email_idx on public.trip_members (email);

-- Hulpfuncties. "security definer" voorkomt dat de policies van trips en
-- trip_members elkaar eindeloos aanroepen.
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_trip_owner(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = tid and owner = auth.uid())
$$;

create or replace function public.is_trip_member(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = tid and email = public.my_email())
$$;

create or replace function public.can_access_trip(tid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_trip_owner(tid) or public.is_trip_member(tid)
$$;

-- Voor bestandspaden: de eerste map is het reis-id.
create or replace function public.can_access_trip_path(folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_trip(folder::uuid)
    else false
  end
$$;

-- ============ Toegangsregels (RLS) ============

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

drop policy if exists "trips_select_own" on public.trips;
drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;
drop policy if exists "trips_delete_own" on public.trips;
drop policy if exists "trips_select" on public.trips;
drop policy if exists "trips_insert" on public.trips;
drop policy if exists "trips_update" on public.trips;
drop policy if exists "trips_delete" on public.trips;

-- Eigenaar en medereizigers zien en bewerken de reis; alleen de eigenaar verwijdert.
create policy "trips_select" on public.trips for select
  using (owner = auth.uid() or public.is_trip_member(id));
create policy "trips_insert" on public.trips for insert
  with check (owner = auth.uid());
create policy "trips_update" on public.trips for update
  using (owner = auth.uid() or public.is_trip_member(id))
  with check (owner = auth.uid() or public.is_trip_member(id));
create policy "trips_delete" on public.trips for delete
  using (owner = auth.uid());

-- Een medereiziger mag de eigenaar niet veranderen.
create or replace function public.keep_trip_owner() returns trigger
language plpgsql as $$
begin
  new.owner := old.owner;
  new.owner_email := old.owner_email;
  return new;
end $$;
drop trigger if exists trips_keep_owner on public.trips;
create trigger trips_keep_owner before update on public.trips
  for each row execute function public.keep_trip_owner();

drop policy if exists "members_select" on public.trip_members;
drop policy if exists "members_insert" on public.trip_members;
drop policy if exists "members_delete" on public.trip_members;

-- Iedereen in de reis ziet wie er meedoet; alleen de eigenaar nodigt uit;
-- de eigenaar haalt iemand weg, of je verlaat zelf de reis.
create policy "members_select" on public.trip_members for select
  using (public.can_access_trip(trip_id));
create policy "members_insert" on public.trip_members for insert
  with check (public.is_trip_owner(trip_id));
create policy "members_delete" on public.trip_members for delete
  using (public.is_trip_owner(trip_id) or email = public.my_email());

-- ============ Live bijwerken (Realtime) ============

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;

-- ============ Bestanden: tickets en bevestigingen ============

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "documents_select" on storage.objects;
drop policy if exists "documents_insert" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

create policy "documents_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_access_trip_path((storage.foldername(name))[1]));
create policy "documents_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_access_trip_path((storage.foldername(name))[1]));
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_access_trip_path((storage.foldername(name))[1]));
