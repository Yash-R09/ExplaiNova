begin;

alter table public.generation_jobs add column assembly_ready_at timestamptz;
alter table public.generation_jobs drop constraint generation_jobs_error_code_check;
alter table public.generation_jobs add constraint generation_jobs_error_code_check
  check (error_code in ('VIDEO_ATTEMPTS_EXHAUSTED', 'VIDEO_WORKER_FAILED', 'VIDEO_NARRATION_TOO_LONG', 'VIDEO_NARRATION_CHECKPOINT_INVALID'));
alter table private.outbox_events add column assembly_manifest jsonb
  check (assembly_manifest is null or jsonb_typeof(assembly_manifest) = 'object');

create function public.read_video_assembly_inputs(p_job_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('contentHash', approval.content_hash, 'settings', approval.settings_snapshot,
    'storyboard', case when approval.revision = 1 then source.storyboard else revision.content end,
    'narration', event.narration_manifest)
  from public.generation_jobs job
  join private.outbox_events event on event.job_id = job.id
  join public.storyboard_approvals approval on approval.id = job.approval_id
  join public.planning_requests source on source.id = approval.storyboard_id
  left join public.storyboard_revisions revision on revision.id = approval.revision_id
    and revision.storyboard_id = source.id
  where job.id = p_job_id and job.status = 'queued' and job.narration_ready_at is not null
    and event.narration_manifest is not null and (approval.revision = 1 or revision.id is not null);
$$;

create function public.complete_video_assembly(p_job_id uuid, p_manifest jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_event private.outbox_events%rowtype;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object' or pg_column_size(p_manifest) > 131072
    or coalesce(p_manifest->>'contentHash', '') !~ '^[0-9a-f]{64}$' then return false; end if;
  select * into v_event from private.outbox_events where job_id = p_job_id for update;
  if not found or v_event.narration_manifest is null
    or p_manifest->'contentHash' is distinct from v_event.narration_manifest->'contentHash' then return false; end if;
  if v_event.assembly_manifest is not null then return v_event.assembly_manifest = p_manifest; end if;
  update public.generation_jobs set assembly_ready_at = clock_timestamp()
    where id = p_job_id and status = 'queued' and narration_ready_at is not null;
  if not found then return false; end if;
  update private.outbox_events set assembly_manifest = p_manifest where id = v_event.id;
  return true;
end;
$$;

create function public.fail_video_assembly(p_job_id uuid, p_error_code text)
returns boolean language sql security definer set search_path = '' as $$
  with failed as (
    update public.generation_jobs set status = 'failed', error_code = p_error_code
    where id = p_job_id and status = 'queued' and narration_ready_at is not null and assembly_ready_at is null
      and p_error_code in ('VIDEO_NARRATION_TOO_LONG', 'VIDEO_NARRATION_CHECKPOINT_INVALID')
    returning id
  )
  select exists (select 1 from failed);
$$;

revoke all on function public.read_video_assembly_inputs(uuid), public.complete_video_assembly(uuid,jsonb), public.fail_video_assembly(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_video_assembly_inputs(uuid), public.complete_video_assembly(uuid,jsonb),
  public.fail_video_assembly(uuid,text) to service_role;

commit;
