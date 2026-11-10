begin;

-- Match ECMAScript String.prototype.trim(), including its Unicode whitespace.
create function private.trim_planning_message(p_message text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(p_message, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
$$;

create table public.planning_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid not null,
  project_revision integer not null,
  message text not null check (length(private.trim_planning_message(message)) between 1 and 4000),
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (owner_id, project_id, project_revision)
    references public.project_revisions(owner_id, project_id, revision) on delete cascade
);

create index planning_requests_project_order
  on public.planning_requests(owner_id, project_id, created_at desc, id desc);
alter table public.planning_requests enable row level security;
revoke all on public.planning_requests from public, anon, authenticated;
grant select on public.planning_requests to authenticated;
create policy planning_requests_owner_read on public.planning_requests
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.projects p where p.id = project_id and p.owner_id = planning_requests.owner_id
    )
  );

create function public.submit_brainstorm_request(p_id uuid, p_command jsonb, p_command_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_revision integer;
  v_operation text;
  v_hash text;
  v_cached private.project_commands%rowtype;
  v_request public.planning_requests%rowtype;
  v_response jsonb;
begin
  v_owner := private.active_project_owner();
  if p_id is null or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$'
    or jsonb_typeof(p_command) is distinct from 'object' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  if exists (select 1 from jsonb_object_keys(p_command) k where k not in ('expectedRevision','mode','message','referenceText','baseStoryboardId'))
    or p_command->'mode' is distinct from '"brainstorm"'::jsonb
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

  insert into public.planning_requests(owner_id, project_id, project_revision, message, input_snapshot)
  values(v_owner, p_id, v_revision, private.trim_planning_message(p_command->>'message'),
    jsonb_build_object('draft', private.project_document(p_id, v_owner), 'referenceText', coalesce(p_command->>'referenceText', '')))
  returning * into v_request;

  v_response := jsonb_build_object('id', v_request.id, 'projectId', p_id,
    'projectRevision', v_revision, 'mode', 'brainstorm', 'message', v_request.message,
    'status', 'queued', 'result', null, 'createdAt', v_request.created_at);
  delete from private.project_commands
    where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(v_owner, v_operation, p_command_key, v_hash, v_response);
  return v_response;
end;
$$;

revoke all on function public.submit_brainstorm_request(uuid,jsonb,text) from public, anon, authenticated, service_role;
grant execute on function public.submit_brainstorm_request(uuid,jsonb,text) to authenticated;
commit;
