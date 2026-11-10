begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into auth.users(id, email) values ('15151515-1515-4515-8515-151515151515', 'brainstorm-limit@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"15151515-1515-4515-8515-151515151515","role":"authenticated"}', true);
select set_config('test.project', public.create_idea_project('{"title":"Orbit"}','admission-create-01')->>'id', true);
select set_config('test.command', '{"expectedRevision":1,"mode":"brainstorm","message":"Suggest hooks"}', true);

select lives_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  current_setting('test.command')::jsonb, 'admission-submit-' || n) from generate_series(1,10) n$$,
  'ten distinct submissions are accepted');
select throws_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  current_setting('test.command')::jsonb, 'admission-submit-11')$$,
  'P0001','BRAINSTORM_RATE_LIMITED','direct RPC rejects an eleventh submission');
select lives_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  current_setting('test.command')::jsonb, 'admission-submit-1')$$,
  'exact replay remains available at the limit');
select is((select count(*) from public.planning_requests),10::bigint,'rejection and replay add no requests');

reset role;
update public.planning_requests set created_at = clock_timestamp() - interval '61 minutes'
  where id = (select id from public.planning_requests where project_id = current_setting('test.project')::uuid order by created_at limit 1);
set local role authenticated;
select lives_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  current_setting('test.command')::jsonb, 'admission-submit-11')$$,
  'a rejected key can be retried after the window frees a slot');
select * from finish();
rollback;
