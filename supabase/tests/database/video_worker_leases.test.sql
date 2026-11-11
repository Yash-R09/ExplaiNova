begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(46);

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
select throws_ok($$select public.read_video_render_inputs(current_setting('test.job')::uuid)$$,
  '42501',null,'authenticated callers cannot read private render inputs');
select throws_ok($$select public.read_video_storage_inputs(current_setting('test.job')::uuid)$$,
  '42501',null,'authenticated callers cannot read private storage inputs');
select throws_ok($$select public.record_video_render(current_setting('test.job')::uuid,repeat('a',64),repeat('b',64))$$,
  '42501',null,'authenticated callers cannot record a render');
select throws_ok($$select public.complete_video_storage(current_setting('test.job')::uuid,'https://projecta.supabase.co','staging',repeat('a',64),10,repeat('b',64),4)$$,
  '42501',null,'authenticated callers cannot finalize artifact storage');
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
select set_config('test.next_claim', public.claim_video_job()::text, true);
select is(current_setting('test.next_claim')::jsonb->>'jobId',current_setting('test.next_job'),'claim skips exhausted work and returns the next ready job');
select is(public.claim_video_job(),null::jsonb,'claim returns null once there are no eligible jobs');
select is(public.complete_video_narration(current_setting('test.next_job')::uuid,gen_random_uuid(),'{}'),false,
  'a different lease cannot publish a narration checkpoint');
select is(public.complete_video_narration(current_setting('test.next_job')::uuid,
  (current_setting('test.next_claim')::jsonb->>'leaseToken')::uuid,
  jsonb_build_object('version',1,'scenes','[{"scene":1}]'::jsonb,'contentHash',current_setting('test.next_claim')::jsonb->>'contentHash')),true,
  'the current lease can checkpoint narration');
select is(public.claim_video_job(),null::jsonb,'a completed narration event cannot be claimed again');
select is(public.read_video_assembly_inputs(current_setting('test.next_job')::uuid)->'storyboard'->>'title',
  'Approved gravity','assembly reads the exact approved storyboard');
select set_config('test.assembly',jsonb_build_object('contentHash',current_setting('test.next_claim')::jsonb->>'contentHash',
  'version',1,'durationFrames',1800,'srt','test')::text,true);
select is(public.read_video_storage_inputs(current_setting('test.next_job')::uuid),null::jsonb,
  'storage waits for scene assembly');
select is(public.read_video_render_inputs(current_setting('test.next_job')::uuid),null::jsonb,
  'renderer cannot read inputs before assembly completes');
select is(public.complete_video_assembly(current_setting('test.next_job')::uuid,'{"version":1}'),false,
  'assembly rejects a missing content hash');
select is(public.complete_video_assembly(current_setting('test.next_job')::uuid,current_setting('test.assembly')::jsonb),true,
  'assembly stores a manifest bound to the narration checkpoint');
select is(public.read_video_render_inputs(current_setting('test.next_job')::uuid),current_setting('test.assembly')::jsonb,
  'renderer receives the exact private assembly manifest');
select is(public.complete_video_assembly(current_setting('test.next_job')::uuid,current_setting('test.assembly')::jsonb),true,
  'the same assembly can be replayed safely');
select is(public.fail_video_assembly(current_setting('test.next_job')::uuid,'VIDEO_NARRATION_CHECKPOINT_INVALID'),false,
  'a late checkpoint failure cannot replace a completed assembly');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('a',64),10,encode(sha256('test'::bytea),'hex'),4),
  false,'storage cannot complete without a recorded render');
select is(public.record_video_render(current_setting('test.next_job')::uuid,'wrong',repeat('a',64)),
  false,'the render checkpoint must match the saved assembly');
select is(public.record_video_render(current_setting('test.next_job')::uuid,current_setting('test.assembly')::jsonb->>'contentHash',repeat('a',64)),
  true,'the render checksum is bound to the job and assembly');
select is(public.record_video_render(current_setting('test.next_job')::uuid,current_setting('test.assembly')::jsonb->>'contentHash',repeat('b',64)),
  false,'a different render cannot replace the recorded checksum');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('b',64),10,encode(sha256('test'::bytea),'hex'),4),
  false,'storage rejects an MP4 whose checksum differs from the recorded render');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('a',64),10,repeat('b',64),4),
  false,'storage rejects captions that do not match assembly');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('a',64),10,encode(sha256('test'::bytea),'hex'),4),
  true,'verified artifacts finalize the assembled job');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('a',64),10,encode(sha256('test'::bytea),'hex'),4),
  true,'replaying the same artifact references is safe');
select is(public.read_video_storage_inputs(current_setting('test.next_job')::uuid)->>'storageOrigin',
  'https://projecta.supabase.co','the completed storage reference identifies its Supabase project');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projectb.supabase.co','staging',repeat('a',64),10,encode(sha256('test'::bytea),'hex'),4),
  false,'the same artifact keys in a different project cannot replace the original location');
select is(public.complete_video_storage(current_setting('test.next_job')::uuid,'https://projecta.supabase.co','staging',repeat('b',64),10,encode(sha256('test'::bytea),'hex'),4),
  false,'different artifacts cannot replace a finished job');
reset role;
select is((select status from public.generation_jobs where id = current_setting('test.next_job')::uuid),
  'succeeded','the completed job reports success and releases the active slot');
select isnt((select narration_ready_at from public.generation_jobs where id = current_setting('test.next_job')::uuid),
  null::timestamptz,'the job exposes narration readiness');
select is((select status || ':' || error_code from public.generation_jobs where id = current_setting('test.job')::uuid),
  'failed:VIDEO_ATTEMPTS_EXHAUSTED','exhaustion releases the active-job slot');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"16161616-1616-4616-8616-161616161616","role":"authenticated"}', true);
select set_config('test.invalid_job', public.submit_video_job(current_setting('test.project')::uuid,
  current_setting('test.storyboard')::uuid,current_setting('test.approval')::uuid,'worker-submit-003')->>'id', true);
set local role service_role;
select set_config('test.invalid_claim', public.claim_video_job()::text, true);
select public.complete_video_narration(current_setting('test.invalid_job')::uuid,
  (current_setting('test.invalid_claim')::jsonb->>'leaseToken')::uuid,'{}');
select is(public.fail_video_assembly(current_setting('test.invalid_job')::uuid,'UNEXPECTED'),false,
  'assembly rejects an unrecognized failure code');
select is(public.fail_video_assembly(current_setting('test.invalid_job')::uuid,'VIDEO_NARRATION_CHECKPOINT_INVALID'),true,
  'invalid narration can fail the queued assembly');
set local role authenticated;
select lives_ok($$select public.submit_video_job(current_setting('test.project')::uuid,current_setting('test.storyboard')::uuid,
  current_setting('test.approval')::uuid,'worker-submit-004')$$,'checkpoint failure frees the slot for a new video job');
select * from finish();
rollback;
