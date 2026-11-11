begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into auth.users(id, email) values ('16161616-1616-4616-8616-161616161616', 'video-worker@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"16161616-1616-4616-8616-161616161616","role":"authenticated"}', true);
select set_config('test.project', public.create_idea_project('{"title":"Orbit","settings":{"voice":"male"}}','worker-create-001')->>'id', true);
select set_config('test.storyboard', public.submit_brainstorm_request(current_setting('test.project')::uuid,
  '{"expectedRevision":1,"mode":"storyboard","message":"Plan an explainer."}','worker-plan-0001')->>'id', true);
set local role service_role;
select set_config('test.plan_claim', public.claim_brainstorm_request(current_setting('test.storyboard')::uuid,
  current_setting('test.project')::uuid, auth.uid())::text, true);
select public.finish_storyboard_request(current_setting('test.storyboard')::uuid,
  (current_setting('test.plan_claim')::jsonb->>'attemptId')::uuid,'{"title":"Approved orbit","targetDurationMs":60000}');
set local role authenticated;
select set_config('test.approval', public.approve_storyboard_revision(current_setting('test.storyboard')::uuid,
  1,current_setting('test.storyboard')::uuid,'worker-approve-01')->>'id', true);
select set_config('test.job', public.submit_video_job(current_setting('test.project')::uuid,current_setting('test.storyboard')::uuid,
  current_setting('test.approval')::uuid,'worker-submit-001')->>'id', true);
select throws_ok($$select public.claim_video_job()$$,'42501',null,'authenticated callers cannot claim worker jobs');
select throws_ok($$select public.report_video_job_failure(current_setting('test.job')::uuid,gen_random_uuid(),false)$$,
  '42501',null,'authenticated callers cannot change worker status');

set local role service_role;
select set_config('test.claim', public.claim_video_job()::text, true);
select is(current_setting('test.claim')::jsonb->>'jobId',current_setting('test.job'),'worker claims the queued outbox event');
select is(current_setting('test.claim')::jsonb->'storyboard'->>'title','Approved orbit','worker receives the approved content');
select is(current_setting('test.claim')::jsonb->'settings'->>'voice','male','worker receives the approved voice preference');
select is(public.claim_video_job(),null::jsonb,'a live lease prevents a second claim');
select isnt(public.renew_video_job_lease(current_setting('test.job')::uuid,(current_setting('test.claim')::jsonb->>'leaseToken')::uuid),
  null::timestamptz,'current worker can renew');

reset role;
update private.outbox_events set lease_expires_at = clock_timestamp() - interval '1 second' where job_id = current_setting('test.job')::uuid;
set local role service_role;
select set_config('test.reclaim', public.claim_video_job()::text, true);
select is(current_setting('test.reclaim')::jsonb->>'attempt','2','expired job is recovered as a new attempt');
select is(public.report_video_job_failure(current_setting('test.job')::uuid,(current_setting('test.claim')::jsonb->>'leaseToken')::uuid,false),
  false,'expired worker cannot change the recovered job');
select is(public.report_video_job_failure(current_setting('test.job')::uuid,(current_setting('test.reclaim')::jsonb->>'leaseToken')::uuid,true),
  true,'the current worker can schedule a retry');
select is(public.claim_video_job(),null::jsonb,'retry is unavailable until its delay expires');

reset role;
update private.outbox_events set available_at = clock_timestamp() - interval '1 second' where job_id = current_setting('test.job')::uuid;
set local role service_role;
select set_config('test.last_claim', public.claim_video_job()::text, true);
select is(current_setting('test.last_claim')::jsonb->>'attempt','3','third attempt claims the job after the retry delay');
reset role;
update private.outbox_events set lease_expires_at = clock_timestamp() - interval '1 second' where job_id = current_setting('test.job')::uuid;
insert into auth.users(id, email) values ('17171717-1717-4717-8717-171717171717', 'video-worker-next@example.test');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"17171717-1717-4717-8717-171717171717","role":"authenticated"}', true);
select set_config('test.next_project', public.create_idea_project('{"title":"Gravity"}','worker-create-002')->>'id', true);
select set_config('test.next_storyboard', public.submit_brainstorm_request(current_setting('test.next_project')::uuid,
  '{"expectedRevision":1,"mode":"storyboard","message":"Plan a second explainer."}','worker-plan-0002')->>'id', true);
set local role service_role;
select set_config('test.next_plan_claim', public.claim_brainstorm_request(current_setting('test.next_storyboard')::uuid,
  current_setting('test.next_project')::uuid, auth.uid())::text, true);
select public.finish_storyboard_request(current_setting('test.next_storyboard')::uuid,
  (current_setting('test.next_plan_claim')::jsonb->>'attemptId')::uuid,'{"title":"Approved gravity","targetDurationMs":60000}');
set local role authenticated;
select set_config('test.next_approval', public.approve_storyboard_revision(current_setting('test.next_storyboard')::uuid,
  1,current_setting('test.next_storyboard')::uuid,'worker-approve-02')->>'id', true);
select set_config('test.next_job', public.submit_video_job(current_setting('test.next_project')::uuid,current_setting('test.next_storyboard')::uuid,
  current_setting('test.next_approval')::uuid,'worker-submit-002')->>'id', true);
set local role service_role;
select is(public.claim_video_job()->>'jobId',current_setting('test.next_job'),'claim skips exhausted work and returns the next ready job');
select is(public.claim_video_job(),null::jsonb,'claim returns null once there are no eligible jobs');
reset role;
select is((select status || ':' || error_code from public.generation_jobs where id = current_setting('test.job')::uuid),
  'failed:VIDEO_ATTEMPTS_EXHAUSTED','exhaustion releases the active-job slot');
select * from finish();
rollback;
