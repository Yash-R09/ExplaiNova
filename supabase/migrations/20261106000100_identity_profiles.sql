-- M2a: identity foundation only. Project/worker/publication tables follow later.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  owner_id uuid primary key references auth.users(id) on delete restrict,
  preferences jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  deletion_status text not null default 'active'
    check (deletion_status in ('active', 'pending', 'deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_preferences_object check (jsonb_typeof(preferences) = 'object'),
  constraint profiles_preferences_size check (octet_length(preferences::text) <= 16384)
);

comment on table public.profiles is 'Owned application preferences; identity and credentials stay in Supabase Auth.';
comment on column public.profiles.deletion_status is 'Lifecycle reserved for trusted account cleanup; clients cannot change it.';

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

create policy profiles_owner_read on public.profiles
for select to authenticated
using (owner_id = (select auth.uid()));

-- No public write grants/policies yet. Future preference mutations must validate
-- their schema and compare the expected version inside one transaction.
create function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Never derive ownership or lifecycle from user-editable signup metadata.
  insert into public.profiles (owner_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;

create trigger explainova_auth_user_created
after insert on auth.users
for each row execute function private.create_profile_for_auth_user();

-- Preserve compatibility if this migration is applied after development signups.
insert into public.profiles (owner_id)
select id from auth.users
on conflict (owner_id) do nothing;

create function private.advance_profile_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception using errcode = '23514', message = 'Profile identity and creation timestamp are immutable.';
  end if;
  new.version := old.version + 1;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function private.advance_profile_version() from public, anon, authenticated;

create trigger explainova_profile_updated
before update on public.profiles
for each row execute function private.advance_profile_version();

commit;
