begin;

alter table public.planning_requests
  add column base_storyboard_id uuid,
  add column base_storyboard_revision integer,
  add constraint planning_storyboard_base check (
    (base_storyboard_id is null and base_storyboard_revision is null) or
    (mode = 'storyboard' and base_storyboard_id is not null
      and base_storyboard_revision is not null and base_storyboard_revision >= 1)
  ),
  add foreign key (owner_id, project_id, base_storyboard_id)
    references public.planning_requests(owner_id, project_id, id) on delete cascade;

create index planning_storyboard_suggestions on public.planning_requests(base_storyboard_id, created_at desc, id desc)
  where base_storyboard_id is not null;

create function public.submit_storyboard_suggestion(
  p_id uuid, p_expected_revision integer, p_message text, p_command_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_source public.planning_requests%rowtype;
  v_latest public.storyboard_revisions%rowtype;
  v_revision integer;
  v_request_id uuid;
  v_operation text := 'suggest-storyboard:' || p_id::text;
  v_hash text;
  v_cached private.project_commands%rowtype;
  v_response jsonb;
begin
  v_owner := private.active_project_owner();
  if p_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_message is null or length(p_message) > 4000 or private.trim_planning_message(p_message) = ''
    or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  select * into v_source from public.planning_requests
    where id = p_id and owner_id = v_owner and mode = 'storyboard' and status = 'succeeded'
      and base_storyboard_id is null;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  perform 1 from public.projects where id = v_source.project_id and owner_id = v_owner and deleted_at is null for share;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  perform 1 from public.planning_requests where id = p_id for update;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;

  v_hash := encode(extensions.digest(jsonb_build_array(p_expected_revision, private.trim_planning_message(p_message))::text, 'sha256'), 'hex');
  select * into v_cached from private.project_commands
    where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  if v_cached.expires_at > now() then
    if v_cached.request_hash <> v_hash then raise exception using message = 'IDEMPOTENCY_CONFLICT'; end if;
    return v_cached.response;
  end if;
  select * into v_latest from public.storyboard_revisions where storyboard_id = p_id order by revision desc limit 1;
  v_revision := coalesce(v_latest.revision, 1);
  if v_revision <> p_expected_revision then
    raise exception using message = 'REVISION_CONFLICT', detail = v_revision::text;
  end if;

  insert into public.planning_requests(owner_id, project_id, project_revision, mode, message, input_snapshot,
    base_storyboard_id, base_storyboard_revision)
  values(v_owner, v_source.project_id, v_source.project_revision, 'storyboard', private.trim_planning_message(p_message),
    v_source.input_snapshot || jsonb_build_object('baseStoryboard', coalesce(v_latest.content, v_source.storyboard)),
    p_id, v_revision)
  returning id into v_request_id;

  v_response := jsonb_build_object('id', v_request_id, 'projectId', v_source.project_id, 'baseRevision', v_revision);
  delete from private.project_commands where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(v_owner, v_operation, p_command_key, v_hash, v_response);
  return v_response;
end;
$$;

revoke all on function public.submit_storyboard_suggestion(uuid,integer,text,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_storyboard_suggestion(uuid,integer,text,text) to authenticated;
commit;
