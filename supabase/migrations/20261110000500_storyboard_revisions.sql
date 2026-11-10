begin;

alter table public.planning_requests add unique (owner_id, project_id, id);

create table public.storyboard_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id uuid not null,
  storyboard_id uuid not null,
  revision integer not null check (revision >= 2),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_hash text not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (storyboard_id, revision),
  foreign key (owner_id, project_id, storyboard_id)
    references public.planning_requests(owner_id, project_id, id) on delete cascade
);

alter table public.storyboard_revisions enable row level security;
revoke all on public.storyboard_revisions from public, anon, authenticated, service_role;
grant select on public.storyboard_revisions to authenticated;
create policy storyboard_revisions_owner_read on public.storyboard_revisions
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.planning_requests p where p.id = storyboard_id
    )
  );

create function public.save_storyboard_revision(
  p_owner uuid, p_id uuid, p_expected_revision integer, p_content jsonb, p_command_key text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_source public.planning_requests%rowtype;
  v_saved public.storyboard_revisions%rowtype;
  v_revision integer;
  v_operation text := 'save-storyboard:' || p_id::text;
  v_hash text;
  v_content_hash text;
  v_cached private.project_commands%rowtype;
  v_response jsonb;
begin
  if p_expected_revision is null or p_expected_revision not between 1 and 2147483646
    or jsonb_typeof(p_content) is distinct from 'object'
    or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;

  perform 1 from public.profiles where owner_id = p_owner and deletion_status = 'active' for share;
  if not found then raise exception using message = 'ACCOUNT_UNAVAILABLE'; end if;
  select * into v_source from public.planning_requests
    where id = p_id and owner_id = p_owner and mode = 'storyboard' and status = 'succeeded';
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  perform 1 from public.projects where id = v_source.project_id and owner_id = p_owner and deleted_at is null for share;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;
  perform 1 from public.planning_requests where id = p_id for update;
  if not found then raise exception using message = 'RESOURCE_NOT_FOUND'; end if;

  if p_content->'targetDurationMs' is distinct from v_source.storyboard->'targetDurationMs' then
    raise exception using message = 'VALIDATION_FAILED';
  end if;
  v_content_hash := encode(extensions.digest(p_content::text, 'sha256'), 'hex');
  v_hash := encode(extensions.digest(p_expected_revision::text || ':' || v_content_hash, 'sha256'), 'hex');
  select * into v_cached from private.project_commands
    where owner_id = p_owner and operation = v_operation and command_key = p_command_key;
  if found and v_cached.expires_at > now() then
    if v_cached.request_hash <> v_hash then raise exception using message = 'IDEMPOTENCY_CONFLICT'; end if;
    return v_cached.response;
  end if;
  select coalesce(max(revision), 1) into v_revision from public.storyboard_revisions where storyboard_id = p_id;
  if v_revision <> p_expected_revision then
    raise exception using message = 'REVISION_CONFLICT', detail = v_revision::text;
  end if;

  insert into public.storyboard_revisions(owner_id, project_id, storyboard_id, revision, content, content_hash)
    values(p_owner, v_source.project_id, p_id, v_revision + 1, p_content, v_content_hash)
    returning * into v_saved;
  v_response := jsonb_build_object('id', p_id, 'projectId', v_source.project_id,
    'projectRevision', v_source.project_revision, 'revisionId', v_saved.id, 'revision', v_saved.revision,
    'content', v_saved.content);
  delete from private.project_commands where owner_id = p_owner and operation = v_operation and command_key = p_command_key;
  insert into private.project_commands(owner_id, operation, command_key, request_hash, response)
    values(p_owner, v_operation, p_command_key, v_hash, v_response);
  return v_response;
end;
$$;

revoke all on function public.save_storyboard_revision(uuid,uuid,integer,jsonb,text) from public, anon, authenticated, service_role;
grant execute on function public.save_storyboard_revision(uuid,uuid,integer,jsonb,text) to service_role;
commit;
