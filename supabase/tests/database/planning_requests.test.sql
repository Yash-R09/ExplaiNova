begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

insert into auth.users(id, email) values
  ('12121212-1212-4212-8212-121212121212', 'planning-owner@example.test'),
  ('13131313-1313-4313-8313-131313131313', 'planning-other@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"12121212-1212-4212-8212-121212121212","role":"authenticated"}', true);
select set_config('test.project', (public.create_idea_project('{"title":"Orbit","brief":"Original brief"}','planning-create-01')->>'id'), true);
select throws_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  jsonb_build_object('expectedRevision', 1, 'mode', 'brainstorm', 'message', E' \t\n\r '),
  'planning-submit-01')$$,'P0001','VALIDATION_FAILED','RPC rejects tabs and newlines');
select throws_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,
  jsonb_build_object('expectedRevision', 1, 'mode', 'brainstorm', 'message', U&'\00A0\2003\2028\FEFF'),
  'planning-submit-01')$$,'P0001','VALIDATION_FAILED','RPC rejects Unicode whitespace recognized by HTTP');
select set_config('test.command', '{"expectedRevision":1,"mode":"brainstorm","message":"\tSuggest hooks\n","referenceText":"Notes"}', true);
select set_config('test.request', public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'planning-submit-01')::text, true);
select is(current_setting('test.request')::jsonb->>'message','Suggest hooks','RPC trims surrounding whitespace');
select is(current_setting('test.request')::jsonb->>'status','queued','request is durably queued');
select is(public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'planning-submit-01'),current_setting('test.request')::jsonb,'retry returns original request');
select is((select count(*) from public.planning_requests),1::bigint,'retry does not append a message');
select throws_ok($$update public.planning_requests set message = 'Changed'$$,'42501',null,'owner cannot change queued input directly');
reset role;
select throws_ok($$update public.planning_requests set message = E'\t\n' where project_id = current_setting('test.project')::uuid$$,
  '23514',null,'table constraint rejects whitespace-only messages');
set local role authenticated;
select lives_ok($$select public.save_idea_project(current_setting('test.project')::uuid,'{"expectedRevision":1,"brief":"New brief"}','planning-save-key1')$$,'draft remains editable');
select is((select input_snapshot->'draft'->>'brief' from public.planning_requests),'Original brief','request keeps its original draft snapshot');
select throws_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'planning-stale-001')$$,'P0001','REVISION_CONFLICT','fresh stale request fails');

select set_config('request.jwt.claims', '{"sub":"13131313-1313-4313-8313-131313131313","role":"authenticated"}', true);
select is((select count(*) from public.planning_requests),0::bigint,'foreign history is hidden');
select throws_ok($$select public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'planning-submit-01')$$,'P0001','RESOURCE_NOT_FOUND','foreign replay is denied');

select set_config('request.jwt.claims', '{"sub":"12121212-1212-4212-8212-121212121212","role":"authenticated"}', true);
select public.trash_idea_project(current_setting('test.project')::uuid,'{"expectedRevision":2}','planning-trash-001');
select is((select count(*) from public.planning_requests),0::bigint,'Trash hides planning history');
select * from finish();
rollback;
