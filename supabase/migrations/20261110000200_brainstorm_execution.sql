begin;

alter table public.planning_requests
  add column status text not null default 'queued',
  add column reply text,
  add column failure_code text,
  add column attempt_id uuid,
  add column lease_until timestamptz,
  add constraint planning_execution_state check (
    case status
      when 'queued' then reply is null and failure_code is null and attempt_id is null and lease_until is null
      when 'running' then reply is null and failure_code is null and attempt_id is not null and lease_until is not null
      when 'succeeded' then reply is not null and length(private.trim_planning_message(reply)) between 1 and 4000
        and failure_code is null and attempt_id is null and lease_until is null
      when 'failed' then reply is null and failure_code is not null
        and failure_code in ('PROVIDER_UNAVAILABLE', 'PROVIDER_RATE_LIMITED', 'PROVIDER_BLOCKED', 'INVALID_PROVIDER_OUTPUT')
        and attempt_id is null and lease_until is null
      else false
    end
  );

create function public.claim_brainstorm_request(p_id uuid, p_project_id uuid, p_owner_id uuid)
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
  return jsonb_build_object('attemptId', v_request.attempt_id, 'message', v_request.message, 'snapshot', v_request.input_snapshot);
end;
$$;

create function public.finish_brainstorm_request(p_id uuid, p_attempt_id uuid, p_reply text default null, p_failure_code text default null)
returns boolean language sql security definer set search_path = '' as $$
  with finished as (
    update public.planning_requests
      set status = case when p_failure_code is null then 'succeeded' else 'failed' end,
          reply = p_reply, failure_code = p_failure_code, attempt_id = null, lease_until = null
      where id = p_id and status = 'running' and attempt_id = p_attempt_id and lease_until > clock_timestamp()
      returning 1
  )
  select exists (select 1 from finished);
$$;

revoke all on function public.claim_brainstorm_request(uuid,uuid,uuid),
  public.finish_brainstorm_request(uuid,uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.claim_brainstorm_request(uuid,uuid,uuid),
  public.finish_brainstorm_request(uuid,uuid,text,text) to service_role;

commit;
