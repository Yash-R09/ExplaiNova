begin;

alter table public.storyboard_approvals add unique (owner_id, project_id, id);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid not null,
  approval_id uuid not null,
  status text not null default 'queued' check (status in (
    'queued', 'running', 'waiting_retry', 'needs_action', 'failed', 'succeeded', 'cancel_requested', 'cancelled'
  )),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (owner_id, project_id, approval_id)
    references public.storyboard_approvals(owner_id, project_id, id) on delete cascade
);
create unique index one_active_video_job_per_owner on public.generation_jobs(owner_id)
  where status in ('queued', 'running', 'waiting_retry', 'needs_action', 'cancel_requested');
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from public, anon, authenticated, service_role;
grant select on public.generation_jobs to authenticated;
create policy generation_jobs_owner_read on public.generation_jobs for select to authenticated using (
  owner_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = generation_jobs.project_id and p.deleted_at is null
  )
);

create table private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.generation_jobs(id) on delete cascade,
  event_type text not null check (event_type = 'video.requested'),
  available_at timestamptz not null default clock_timestamp(),
  dispatched_at timestamptz
);
revoke all on private.outbox_events from public, anon, authenticated, service_role;

create function public.submit_video_job(p_project_id uuid, p_storyboard_id uuid, p_approval_id uuid, p_command_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := private.active_project_owner();
  v_source public.planning_requests%rowtype;
  v_head public.storyboard_revisions%rowtype;
  v_approval public.storyboard_approvals%rowtype;
  v_cached private.project_commands%rowtype;
  v_job public.generation_jobs%rowtype;
  v_hash text;
  v_response jsonb;
begin
  if p_project_id is null or p_storyboard_id is null or p_approval_id is null
    or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('submit-video:' || v_owner::text, 0));
  perform 1 from public.projects where id = p_project_id and owner_id = v_owner and deleted_at is null for share;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  select * into v_source from public.planning_requests
    where id = p_storyboard_id and owner_id = v_owner and project_id = p_project_id
      and mode = 'storyboard' and status = 'succeeded' and base_storyboard_id is null for update;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  select * into v_approval from public.storyboard_approvals
    where id = p_approval_id and owner_id = v_owner and project_id = p_project_id and storyboard_id = p_storyboard_id;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;

  v_hash := encode(extensions.digest(jsonb_build_array(p_project_id, p_storyboard_id, p_approval_id)::text, 'sha256'), 'hex');
  select * into v_cached from private.project_commands
    where owner_id = v_owner and operation = 'submit-video' and command_key = p_command_key;
  if v_cached.expires_at > now() then
    if v_cached.request_hash <> v_hash then raise exception using message = 'IDEMPOTENCY_CONFLICT'; end if;
    return v_cached.response;
  end if;

  select * into v_head from public.storyboard_revisions where storyboard_id = p_storyboard_id order by revision desc limit 1;
  if v_approval.revision <> coalesce(v_head.revision, 1) or v_approval.revision_id <> coalesce(v_head.id, p_storyboard_id)
    or v_approval.content_hash is distinct from coalesce(v_head.content_hash, encode(extensions.digest(v_source.storyboard::text, 'sha256'), 'hex')) then
    raise exception using message = 'VIDEO_APPROVAL_STALE';
  end if;
  insert into public.generation_jobs(owner_id, project_id, approval_id)
    values(v_owner, p_project_id, p_approval_id)
    on conflict (owner_id) where status in ('queued', 'running', 'waiting_retry', 'needs_action', 'cancel_requested')
    do nothing returning * into v_job;
  if not found then raise exception using message = 'VIDEO_JOB_ACTIVE'; end if;
  insert into private.outbox_events(job_id, event_type) values(v_job.id, 'video.requested');

  v_response := jsonb_build_object('id', v_job.id, 'projectId', v_job.project_id,
    'approvalId', v_job.approval_id, 'kind', 'video', 'status', v_job.status, 'createdAt', v_job.created_at);
  delete from private.project_commands where owner_id = v_owner and operation = 'submit-video' and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(v_owner, 'submit-video', p_command_key, v_hash, v_response);
  return v_response;
end;
$$;

revoke all on function public.submit_video_job(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_video_job(uuid,uuid,uuid,text) to authenticated;
commit;
