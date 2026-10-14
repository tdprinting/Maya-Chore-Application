-- Maya's Ohana Stars: Supabase schema
-- Paste this whole file into Supabase > SQL Editor > New query, and press Run.
-- It is safe to run more than once.

-- A family groups the devices that share chores, points and prizes.
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Family',
  parent_code text not null unique,
  kid_code text not null unique,
  created_at timestamptz not null default now()
);

-- Each signed-in device (anonymous Supabase user) belongs to one family as a parent or a kid.
create table if not exists public.members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  role text not null check (role in ('parent', 'kid')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Everything else (chores, submissions, prizes, points ledger, notes...) is a JSON item.
create table if not exists public.items (
  id text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists items_family_idx on public.items (family_id);

create or replace function public.is_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.is_parent(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where family_id = fid and user_id = auth.uid() and role = 'parent');
$$;

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;

drop policy if exists "members read family" on public.families;
create policy "members read family" on public.families for select using (public.is_member(id));

drop policy if exists "read own memberships" on public.members;
create policy "read own memberships" on public.members for select using (user_id = auth.uid() or public.is_parent(family_id));

drop policy if exists "parents remove members" on public.members;
create policy "parents remove members" on public.members for delete using (public.is_parent(family_id));

drop policy if exists "family reads items" on public.items;
create policy "family reads items" on public.items for select using (public.is_member(family_id));
drop policy if exists "family adds items" on public.items;
create policy "family adds items" on public.items for insert with check (public.is_member(family_id));
drop policy if exists "family updates items" on public.items;
create policy "family updates items" on public.items for update using (public.is_member(family_id)) with check (public.is_member(family_id));
drop policy if exists "family removes items" on public.items;
create policy "family removes items" on public.items for delete using (public.is_member(family_id));

-- Random join code like "KID-7F3A9C1D". Uses the built-in gen_random_uuid(), so it works with the
-- locked-down search_path of the functions below (pgcrypto lives in the "extensions" schema on Supabase).
create or replace function public.make_code(prefix text)
returns text language sql volatile set search_path = pg_catalog as $$
  select prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create or replace function public.create_family(family_name text)
returns json language plpgsql security definer set search_path = public as $$
declare f public.families;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.families (name, parent_code, kid_code)
  values (coalesce(nullif(family_name, ''), 'Our Family'), public.make_code('PARENT'), public.make_code('KID'))
  returning * into f;
  insert into public.members (family_id, user_id, role) values (f.id, auth.uid(), 'parent');
  return json_build_object('family_id', f.id, 'role', 'parent');
end $$;

create or replace function public.join_family(code text)
returns json language plpgsql security definer set search_path = public as $$
declare f public.families; r text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into f from public.families where upper(parent_code) = upper(trim(code));
  if found then r := 'parent';
  else
    select * into f from public.families where upper(kid_code) = upper(trim(code));
    if found then r := 'kid'; else raise exception 'That code did not match a family'; end if;
  end if;
  insert into public.members (family_id, user_id, role) values (f.id, auth.uid(), r)
  on conflict (family_id, user_id) do update set role = excluded.role;
  return json_build_object('family_id', f.id, 'role', r);
end $$;

-- Parents can read the join codes; kids never see the parent code.
create or replace function public.family_codes(fid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare f public.families;
begin
  if not public.is_parent(fid) then raise exception 'Parents only'; end if;
  select * into f from public.families where id = fid;
  return json_build_object('parent_code', f.parent_code, 'kid_code', f.kid_code, 'name', f.name);
end $$;

revoke select on public.families from anon, authenticated;
grant select (id, name, created_at) on public.families to authenticated;

-- Only signed-in devices may call the family functions; make_code is internal.
revoke execute on function public.make_code(text) from public, anon, authenticated;
revoke execute on function public.create_family(text) from public, anon;
revoke execute on function public.join_family(text) from public, anon;
revoke execute on function public.family_codes(uuid) from public, anon;
grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.family_codes(uuid) to authenticated;

-- Live updates: every device in the family hears about changes instantly.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;

-- Photos (chore proof, homework, wish list pictures) live in a private bucket,
-- in a folder named after the family id.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Compares the folder name as text: casting it to uuid inside a policy can raise errors for
-- objects in other buckets, because Postgres does not promise to check bucket_id first.
create or replace function public.is_member_folder(folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where family_id::text = folder and user_id = auth.uid());
$$;

drop policy if exists "family reads photos" on storage.objects;
create policy "family reads photos" on storage.objects for select
  using (bucket_id = 'photos' and public.is_member_folder((storage.foldername(name))[1]));
drop policy if exists "family uploads photos" on storage.objects;
create policy "family uploads photos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member_folder((storage.foldername(name))[1]));
drop policy if exists "family deletes photos" on storage.objects;
create policy "family deletes photos" on storage.objects for delete
  using (bucket_id = 'photos' and public.is_member_folder((storage.foldername(name))[1]));
