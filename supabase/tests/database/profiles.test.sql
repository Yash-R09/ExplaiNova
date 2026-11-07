-- Local-only, rolled-back fixtures. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(29);

select has_table('public', 'profiles', 'Profile table exists');
select col_is_pk('public', 'profiles', 'owner_id', 'Identity is the profile primary key');
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'RLS is enabled');

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.test', '{"owner_id":"22222222-2222-4222-8222-222222222222","role":"admin"}'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.test', '{}');

select is((select count(*) from public.profiles where owner_id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 2::bigint, 'Signup trigger creates both owned profiles');
select is((select version from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111'), 1, 'Version starts at one');
select is((select preferences from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111'), '{}'::jsonb, 'Untrusted metadata is not copied to preferences');
select is((select deletion_status from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111'), 'active', 'New profile is active');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'Alice sees exactly one profile');
select is((select owner_id::text from public.profiles), '11111111-1111-4111-8111-111111111111', 'Signup metadata cannot transfer ownership');
select is((select count(*) from public.profiles where owner_id = '22222222-2222-4222-8222-222222222222'), 0::bigint, 'Alice cannot read Bob by ID');
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select owner_id::text from public.profiles), '22222222-2222-4222-8222-222222222222', 'Bob sees only his own profile');
select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from public.profiles), 0::bigint, 'Missing identity exposes no profiles');

set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'Anonymous reads are denied');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select throws_ok($$insert into public.profiles(owner_id) values ('33333333-3333-4333-8333-333333333333')$$, '42501', null, 'Clients cannot create profiles');
select throws_ok($$update public.profiles set deletion_status = 'deleting'$$, '42501', null, 'Clients cannot modify lifecycle or bypass versioning');
select throws_ok('delete from public.profiles', '42501', null, 'Clients cannot delete profiles');
select is(has_schema_privilege('authenticated', 'private', 'USAGE'), false, 'Private schema is inaccessible to clients');
select throws_ok('select private.create_profile_for_auth_user()', '42501', null, 'Signup helper is not callable by clients');

reset role;
select throws_ok($$insert into public.profiles(owner_id, preferences) values ('33333333-3333-4333-8333-333333333333', '[]')$$, '23514', null, 'Array preferences are invalid');
select throws_ok($$insert into public.profiles(owner_id, preferences) values ('33333333-3333-4333-8333-333333333333', 'null')$$, '23514', null, 'JSON null preferences are invalid');
select throws_ok($$insert into public.profiles(owner_id, version) values ('33333333-3333-4333-8333-333333333333', 0)$$, '23514', null, 'Nonpositive versions are invalid');
select throws_ok($$insert into public.profiles(owner_id, deletion_status) values ('33333333-3333-4333-8333-333333333333', 'published')$$, '23514', null, 'Unknown lifecycle states are invalid');
select throws_ok($$insert into public.profiles(owner_id, preferences) values ('33333333-3333-4333-8333-333333333333', jsonb_build_object('oversized', repeat('x', 17000)))$$, '23514', null, 'Oversized preferences are invalid');
select throws_ok($$insert into public.profiles(owner_id) values ('33333333-3333-4333-8333-333333333333')$$, '23503', null, 'Profiles require a real Auth identity');

create temporary table original_profile as select * from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111';
set local role service_role;
update public.profiles set preferences = '{"captions":true}' where owner_id = '11111111-1111-4111-8111-111111111111';
select is((select version from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111'), 2, 'Trusted update advances version');
reset role;
select is((select created_at from public.profiles where owner_id = '11111111-1111-4111-8111-111111111111'), (select created_at from original_profile), 'Trusted update preserves creation time');
select throws_ok($$update public.profiles set owner_id = '33333333-3333-4333-8333-333333333333' where owner_id = '11111111-1111-4111-8111-111111111111'$$, '23514', null, 'Profile identity is immutable');
select throws_ok($$update public.profiles set created_at = created_at - interval '1 day' where owner_id = '11111111-1111-4111-8111-111111111111'$$, '23514', null, 'Creation timestamp is immutable');
select throws_ok($$delete from auth.users where id = '11111111-1111-4111-8111-111111111111'$$, '23503', null, 'Identity deletion requires explicit profile cleanup');

select * from finish();
rollback;
