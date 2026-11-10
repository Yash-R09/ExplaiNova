begin;

alter table public.planning_requests
  add column mode text not null default 'brainstorm' check (mode in ('brainstorm', 'storyboard')),
  add column storyboard jsonb,
  drop constraint planning_execution_state,
  add constraint planning_execution_state check (
    case status
      when 'queued' then reply is null and storyboard is null and failure_code is null and attempt_id is null and lease_until is null
      when 'running' then reply is null and storyboard is null and failure_code is null and attempt_id is not null and lease_until is not null
      when 'succeeded' then failure_code is null and attempt_id is null and lease_until is null and (
        (mode = 'brainstorm' and storyboard is null and reply is not null and length(private.trim_planning_message(reply)) between 1 and 4000)
        or (mode = 'storyboard' and reply is null and storyboard is not null and jsonb_typeof(storyboard) = 'object')
      )
      when 'failed' then reply is null and storyboard is null and failure_code is not null
        and failure_code in ('PROVIDER_UNAVAILABLE', 'PROVIDER_RATE_LIMITED', 'PROVIDER_BLOCKED', 'INVALID_PROVIDER_OUTPUT')
        and attempt_id is null and lease_until is null
      else false
    end
  );

create or replace function public.submit_brainstorm_request(p_id uuid, p_command jsonb, p_command_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_mode text;
  v_revision integer;
  v_operation text;
  v_hash text;
  v_cached private.project_commands%rowtype;
  v_request public.planning_requests%rowtype;
  v_response jsonb;
  v_draft jsonb;
begin
  v_owner := private.active_project_owner();
  if p_id is null or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$'
    or jsonb_typeof(p_command) is distinct from 'object' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  v_mode := p_command->>'mode';
  if exists (select 1 from jsonb_object_keys(p_command) k where k not in ('expectedRevision','mode','message','referenceText','baseStoryboardId'))
    or (v_mode is null or v_mode not in ('brainstorm', 'storyboard'))
    or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number'
    or jsonb_typeof(p_command->'message') is distinct from 'string'
    or private.trim_planning_message(p_command->>'message') = ''
    or length(p_command->>'message') > 4000
    or (p_command ? 'referenceText' and (jsonb_typeof(p_command->'referenceText') <> 'string' or length(p_command->>'referenceText') > 20000))
    or (p_command ? 'baseStoryboardId' and p_command->'baseStoryboardId' <> 'null'::jsonb) then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  if (p_command->>'expectedRevision')::numeric not between 1 and 2147483647
    or trunc((p_command->>'expectedRevision')::numeric) <> (p_command->>'expectedRevision')::numeric then
    raise exception using message = 'VALIDATION_FAILED';
  end if;

  v_operation := 'brainstorm:' || p_id::text;
  v_hash := encode(extensions.digest(p_command::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || v_operation || ':' || p_command_key, 0));
  select * into v_cached from private.project_commands
    where owner_id = v_owner and operation = v_operation and command_key = p_command_key;

  select edit_version into v_revision from public.projects
    where id = p_id and owner_id = v_owner and deleted_at is null for share;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  if v_cached.expires_at > now() then
    if v_cached.request_hash <> v_hash then raise exception using message = 'IDEMPOTENCY_CONFLICT'; end if;
    return v_cached.response;
  end if;
  if v_revision <> (p_command->>'expectedRevision')::integer then
    raise exception using message = 'REVISION_CONFLICT', detail = v_revision::text;
  end if;

  v_draft := private.project_document(p_id, v_owner);
  if v_mode = 'storyboard' and v_draft->>'title' = 'Untitled idea'
    and private.trim_planning_message(v_draft->>'brief') = ''
    and private.trim_planning_message(v_draft->>'referenceText') = ''
    and private.trim_planning_message(coalesce(p_command->>'referenceText', '')) = ''
    and private.trim_planning_message(p_command->>'message') = 'Generate a storyboard.' then
    raise exception using message = 'STORYBOARD_IDEA_REQUIRED';
  end if;

  insert into public.planning_requests(owner_id, project_id, project_revision, mode, message, input_snapshot)
  values(v_owner, p_id, v_revision, v_mode, private.trim_planning_message(p_command->>'message'),
    jsonb_build_object('draft', v_draft, 'referenceText', coalesce(p_command->>'referenceText', '')))
  returning * into v_request;

  v_response := jsonb_build_object('id', v_request.id, 'projectId', p_id,
    'projectRevision', v_revision, 'mode', v_mode, 'message', v_request.message,
    'status', 'queued', 'result', null, 'createdAt', v_request.created_at);
  delete from private.project_commands
    where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(v_owner, v_operation, p_command_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.claim_brainstorm_request(p_id uuid, p_project_id uuid, p_owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_request public.planning_requests%rowtype;
begin
  -- Hold the project active through admission, with the same lock order as draft commands.
  perform 1 from public.profiles
    where owner_id = p_owner_id and deletion_status = 'active' for share;
  if not found then return null; end if;
  perform 1 from public.projects
    where id = p_project_id and owner_id = p_owner_id and deleted_at is null for share;
  if not found then return null; end if;

  update public.planning_requests
    set status = 'running', attempt_id = gen_random_uuid(), lease_until = clock_timestamp() + interval '2 minutes'
    where id = p_id and project_id = p_project_id and owner_id = p_owner_id
      and (status = 'queued' or (status = 'running' and lease_until <= clock_timestamp()))
    returning * into v_request;
  if not found then return null; end if;
  return jsonb_build_object('attemptId', v_request.attempt_id, 'mode', v_request.mode, 'message', v_request.message, 'snapshot', v_request.input_snapshot);
end;
$$;

create function public.finish_storyboard_request(p_id uuid, p_attempt_id uuid, p_storyboard jsonb default null, p_failure_code text default null)
returns boolean language sql security definer set search_path = '' as $$
  with finished as (
    update public.planning_requests
      set status = case when p_failure_code is null then 'succeeded' else 'failed' end,
          storyboard = p_storyboard, failure_code = p_failure_code, attempt_id = null, lease_until = null
      where id = p_id and mode = 'storyboard' and status = 'running' and attempt_id = p_attempt_id and lease_until > clock_timestamp()
      returning 1
  )
  select exists (select 1 from finished);
$$;

revoke all on function public.finish_storyboard_request(uuid,uuid,jsonb,text) from public, anon, authenticated, service_role;
grant execute on function public.finish_storyboard_request(uuid,uuid,jsonb,text) to service_role;
commit;
