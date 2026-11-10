begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users(id, email) values ('14141414-1414-4414-8414-141414141414', 'brainstorm-owner@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14141414-1414-4414-8414-141414141414","role":"authenticated"}', true);
select set_config('test.project', public.create_idea_project('{"title":"Orbit"}','execution-create-01')->>'id', true);
select set_config('test.command', '{"expectedRevision":1,"mode":"brainstorm","message":"Suggest hooks"}', true);
select set_config('test.request', public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'execution-submit-01')->>'id', true);
select throws_ok($$select public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,auth.uid())$$,
  '42501',null,'authenticated callers cannot claim requests');
select throws_ok($$select public.finish_brainstorm_request(current_setting('test.request')::uuid,gen_random_uuid(),'Fake reply')$$,
  '42501',null,'authenticated callers cannot inject replies');

set local role service_role;
select is(public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,gen_random_uuid()),
  null::jsonb,'wrong owner cannot be used to claim a request');
select set_config('test.claim', public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,auth.uid())::text, true);
select is(current_setting('test.claim')::jsonb->'snapshot'->'draft'->>'title','Orbit','claim returns the saved snapshot');
select is(public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,auth.uid()),
  null::jsonb,'an active lease excludes a second claim');
select is(public.finish_brainstorm_request(current_setting('test.request')::uuid,gen_random_uuid(),'Fake reply'),
  false,'a different attempt cannot complete the request');

reset role;
update public.planning_requests set lease_until = clock_timestamp() - interval '1 second' where id = current_setting('test.request')::uuid;
set local role service_role;
select set_config('test.reclaim', public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,auth.uid())::text, true);
select isnt(current_setting('test.reclaim')::jsonb->>'attemptId',current_setting('test.claim')::jsonb->>'attemptId','an expired lease can be reclaimed with a fresh attempt');
select is(public.finish_brainstorm_request(current_setting('test.request')::uuid,(current_setting('test.claim')::jsonb->>'attemptId')::uuid,'Late reply'),
  false,'the expired attempt cannot overwrite the replacement');
select is(public.finish_brainstorm_request(current_setting('test.request')::uuid,(current_setting('test.reclaim')::jsonb->>'attemptId')::uuid,'Open with a falling satellite.'),
  true,'the current attempt saves the reply');
select is(public.claim_brainstorm_request(current_setting('test.request')::uuid,current_setting('test.project')::uuid,auth.uid()),
  null::jsonb,'successful requests cannot run again');

set local role authenticated;
select is((select reply from public.planning_requests where id = current_setting('test.request')::uuid),'Open with a falling satellite.','owner can read the completed reply');
select set_config('test.trashed_request', public.submit_brainstorm_request(current_setting('test.project')::uuid,current_setting('test.command')::jsonb,'execution-submit-02')->>'id', true);
select public.trash_idea_project(current_setting('test.project')::uuid,'{"expectedRevision":1}','execution-trash-01');
set local role service_role;
select is(public.claim_brainstorm_request(current_setting('test.trashed_request')::uuid,current_setting('test.project')::uuid,auth.uid()),
  null::jsonb,'requests for trashed projects are not claimed');

select * from finish();
rollback;
