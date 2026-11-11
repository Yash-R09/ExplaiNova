begin;

alter table public.generation_jobs
  add column attempt integer not null default 0 check (attempt between 0 and 3),
  add column error_code text check (error_code in ('VIDEO_ATTEMPTS_EXHAUSTED', 'VIDEO_WORKER_FAILED'));

alter table private.outbox_events
  add column lease_token uuid,
  add column lease_expires_at timestamptz,
  add check ((lease_token is null) = (lease_expires_at is null));
create index pending_video_outbox on private.outbox_events(available_at, id) where dispatched_at is null;

create function public.claim_video_job()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event private.outbox_events%rowtype;
  v_job public.generation_jobs%rowtype;
  v_approval public.storyboard_approvals%rowtype;
  v_content jsonb;
  v_token uuid := gen_random_uuid();
  v_expiry timestamptz;
begin
  loop
    select event.* into v_event
      from private.outbox_events event
      join public.generation_jobs job on job.id = event.job_id
      where event.dispatched_at is null and event.available_at <= clock_timestamp()
        and (event.lease_expires_at is null or event.lease_expires_at <= clock_timestamp())
        and job.status in ('queued', 'running', 'waiting_retry')
      order by event.available_at, event.id
      for update of event skip locked limit 1;
    if not found then return null; end if;

    select * into v_job from public.generation_jobs where id = v_event.job_id for update;
    if not found or v_job.status not in ('queued', 'running', 'waiting_retry') then continue; end if;
    exit when v_job.attempt < 3;

    update public.generation_jobs set status = 'failed', error_code = 'VIDEO_ATTEMPTS_EXHAUSTED' where id = v_job.id;
    update private.outbox_events set dispatched_at = clock_timestamp(), lease_token = null, lease_expires_at = null
      where id = v_event.id;
  end loop;

  select * into strict v_approval from public.storyboard_approvals where id = v_job.approval_id;
  if v_approval.revision = 1 then
    select storyboard into strict v_content from public.planning_requests where id = v_approval.storyboard_id;
  else
    select content into strict v_content from public.storyboard_revisions
      where id = v_approval.revision_id and storyboard_id = v_approval.storyboard_id;
  end if;

  v_expiry := clock_timestamp() + interval '2 minutes';
  update private.outbox_events set lease_token = v_token, lease_expires_at = v_expiry where id = v_event.id;
  update public.generation_jobs set status = 'running', attempt = attempt + 1, error_code = null
    where id = v_job.id returning * into v_job;
  return jsonb_build_object('jobId', v_job.id, 'attempt', v_job.attempt, 'leaseToken', v_token,
    'leaseExpiresAt', v_expiry, 'approvalId', v_approval.id, 'revisionId', v_approval.revision_id,
    'contentHash', v_approval.content_hash, 'storyboard', v_content, 'settings', v_approval.settings_snapshot);
end;
$$;

create function public.renew_video_job_lease(p_job_id uuid, p_lease_token uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_expiry timestamptz;
begin
  update private.outbox_events
    set lease_expires_at = clock_timestamp() + interval '2 minutes'
    where job_id = p_job_id and lease_token = p_lease_token and dispatched_at is null
      and lease_expires_at > clock_timestamp()
    returning lease_expires_at into v_expiry;
  return v_expiry;
end;
$$;

create function public.report_video_job_failure(p_job_id uuid, p_lease_token uuid, p_retryable boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_event private.outbox_events%rowtype;
  v_attempt integer;
  v_retry boolean;
begin
  if p_retryable is null then return false; end if;
  select * into v_event from private.outbox_events where job_id = p_job_id for update;
  if not found or p_lease_token is null or v_event.lease_token is distinct from p_lease_token
    or v_event.dispatched_at is not null or v_event.lease_expires_at <= clock_timestamp() then return false; end if;
  select attempt into v_attempt from public.generation_jobs where id = p_job_id and status = 'running' for update;
  if not found or v_event.lease_expires_at <= clock_timestamp() then return false; end if;
  v_retry := p_retryable and v_attempt < 3;
  update public.generation_jobs set status = case when v_retry then 'waiting_retry' else 'failed' end,
    error_code = case when p_retryable and not v_retry then 'VIDEO_ATTEMPTS_EXHAUSTED' else 'VIDEO_WORKER_FAILED' end
    where id = p_job_id;
  update private.outbox_events set lease_token = null, lease_expires_at = null,
    available_at = clock_timestamp() + interval '30 seconds',
    dispatched_at = case when v_retry then null else clock_timestamp() end
    where id = v_event.id;
  return true;
end;
$$;

revoke all on function public.claim_video_job(), public.renew_video_job_lease(uuid,uuid),
  public.report_video_job_failure(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.claim_video_job(), public.renew_video_job_lease(uuid,uuid),
  public.report_video_job_failure(uuid,uuid,boolean) to service_role;

commit;
