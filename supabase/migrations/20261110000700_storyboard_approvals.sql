begin;

create table public.storyboard_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid not null,
  storyboard_id uuid not null,
  revision_id uuid not null,
  revision integer not null check (revision >= 1),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  settings_snapshot jsonb not null check (jsonb_typeof(settings_snapshot) = 'object'),
  approved_at timestamptz not null default clock_timestamp(),
  unique (storyboard_id, revision),
  foreign key (owner_id, project_id, storyboard_id)
    references public.planning_requests(owner_id, project_id, id) on delete cascade
);

alter table public.storyboard_approvals enable row level security;
revoke all on public.storyboard_approvals from public, anon, authenticated, service_role;
grant select on public.storyboard_approvals to authenticated;
create policy storyboard_approvals_owner_read on public.storyboard_approvals
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.planning_requests p where p.id = storyboard_id
    )
  );

create function public.approve_storyboard_revision(
  p_id uuid, p_expected_revision integer, p_revision_id uuid, p_command_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_source public.planning_requests%rowtype;
  v_head public.storyboard_revisions%rowtype;
  v_approval public.storyboard_approvals%rowtype;
  v_cached private.project_commands%rowtype;
  v_operation text := 'approve-storyboard:' || p_id::text;
  v_request_hash text;
  v_revision integer;
  v_revision_id uuid;
  v_content_hash text;
  v_response jsonb;
begin
  v_owner := private.active_project_owner();
  if p_id is null or p_expected_revision is null or p_expected_revision < 1 or p_revision_id is null
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

  v_request_hash := encode(extensions.digest(p_expected_revision::text || ':' || p_revision_id::text, 'sha256'), 'hex');
  select * into v_cached from private.project_commands
    where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  if v_cached.expires_at > now() then
    if v_cached.request_hash <> v_request_hash then raise exception using message = 'IDEMPOTENCY_CONFLICT'; end if;
    return v_cached.response;
  end if;
  select * into v_head from public.storyboard_revisions where storyboard_id = p_id order by revision desc limit 1;
  v_revision := coalesce(v_head.revision, 1);
  v_revision_id := coalesce(v_head.id, p_id);
  if v_revision <> p_expected_revision or v_revision_id <> p_revision_id then
    raise exception using message = 'REVISION_CONFLICT', detail = v_revision::text;
  end if;

  select * into v_approval from public.storyboard_approvals where storyboard_id = p_id and revision = v_revision;
  if not found then
    v_content_hash := coalesce(v_head.content_hash, encode(extensions.digest(v_source.storyboard::text, 'sha256'), 'hex'));
    insert into public.storyboard_approvals(owner_id, project_id, storyboard_id, revision_id, revision, content_hash, settings_snapshot)
      values(v_owner, v_source.project_id, p_id, v_revision_id, v_revision, v_content_hash, v_source.input_snapshot->'draft'->'settings')
      returning * into v_approval;
  end if;
  v_response := jsonb_build_object('id', v_approval.id, 'revisionId', v_approval.revision_id,
    'revision', v_approval.revision, 'contentHash', v_approval.content_hash, 'approvedAt', v_approval.approved_at);
  delete from private.project_commands where owner_id = v_owner and operation = v_operation and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(v_owner, v_operation, p_command_key, v_request_hash, v_response);
  return v_response;
end;
$$;

revoke all on function public.approve_storyboard_revision(uuid,integer,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.approve_storyboard_revision(uuid,integer,uuid,text) to authenticated;
commit;
