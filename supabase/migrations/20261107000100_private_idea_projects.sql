-- M3a: private idea drafts, immutable snapshots, and transactional commands.
begin;
create extension if not exists pgcrypto with schema extensions;

create table public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(owner_id) on delete restrict,
 title varchar(140) not null check (length(btrim(title)) between 1 and 140),
 edit_version integer not null default 1 check (edit_version >= 1),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,id)
);
create table public.project_revisions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 project_id uuid not null,
 revision integer not null check (revision >= 1),
 title varchar(140) not null check (length(btrim(title)) between 1 and 140),
 brief text not null check (length(brief) <= 6000),
 reference_text text not null check (length(reference_text) <= 20000),
 target_duration_ms integer not null check (target_duration_ms in (30000,60000,90000)),
 audience_level text not null check (audience_level in ('beginner','intermediate','advanced')),
 tone text not null check (tone in ('clear','conversational','direct')),
 settings jsonb not null check (jsonb_typeof(settings) = 'object'),
 content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(owner_id,project_id,revision),
 unique(owner_id,project_id,id),
 foreign key(owner_id,project_id) references public.projects(owner_id,id) on delete cascade
);
-- A head can never commit without its matching immutable snapshot.
alter table public.projects add constraint projects_head_revision_fk
 foreign key(owner_id,id,edit_version) references public.project_revisions(owner_id,project_id,revision)
 deferrable initially deferred;
create index projects_library_idx on public.projects(owner_id,updated_at desc,id desc) where deleted_at is null;

create table private.project_commands (
 owner_id uuid not null references auth.users(id) on delete cascade,
 operation text not null,
 command_key varchar(128) not null,
 request_hash text not null,
 response jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '24 hours',
 primary key(owner_id,operation,command_key)
);
create index project_commands_expiry_idx on private.project_commands(expires_at);
revoke all on private.project_commands from public,anon,authenticated;

alter table public.projects enable row level security;
alter table public.project_revisions enable row level security;
revoke all on public.projects,public.project_revisions from public,anon,authenticated;
grant select on public.projects,public.project_revisions to authenticated;
grant select,insert,update,delete on public.projects,public.project_revisions to service_role;
create policy projects_owner_read on public.projects for select to authenticated
 using (owner_id=(select auth.uid()) and deleted_at is null and exists(select 1 from public.profiles p where p.owner_id=projects.owner_id and p.deletion_status='active'));
create policy project_revisions_owner_read on public.project_revisions for select to authenticated
 using (owner_id=(select auth.uid()) and exists(select 1 from public.projects p where p.owner_id=project_revisions.owner_id and p.id=project_revisions.project_id));

create function private.active_project_owner() returns uuid language plpgsql set search_path='' as $$
declare v_owner uuid := auth.uid();
begin
 if v_owner is null then raise exception using message='SESSION_REQUIRED'; end if;
 -- Prevent lifecycle transitions from racing an authoring transaction.
 perform 1 from public.profiles where owner_id=v_owner and deletion_status='active' for share;
 if not found then raise exception using message='ACCOUNT_UNAVAILABLE'; end if;
 return v_owner;
end;
$$;

create function private.validate_project_fields(p_data jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v jsonb;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('title','brief','referenceText','targetDurationMs','audienceLevel','tone')) then raise exception using message='VALIDATION_FAILED'; end if;
 v := jsonb_build_object('title','Untitled idea','brief','','referenceText','','targetDurationMs',60000,'audienceLevel','beginner','tone','clear') || p_data;
 if jsonb_typeof(v->'title')<>'string' or jsonb_typeof(v->'brief')<>'string' or jsonb_typeof(v->'referenceText')<>'string'
  or jsonb_typeof(v->'audienceLevel')<>'string' or jsonb_typeof(v->'tone')<>'string' or jsonb_typeof(v->'targetDurationMs')<>'number' then raise exception using message='VALIDATION_FAILED'; end if;
 if length(btrim(v->>'title')) not between 1 and 140 or length(v->>'brief')>6000 or length(v->>'referenceText')>20000
  or (v->>'targetDurationMs')::numeric not in (30000,60000,90000) or v->>'audienceLevel' not in ('beginner','intermediate','advanced') or v->>'tone' not in ('clear','conversational','direct') then raise exception using message='VALIDATION_FAILED'; end if;
 return jsonb_set(v,'{title}',to_jsonb(btrim(v->>'title')));
end;
$$;

create function private.project_document(p_id uuid,p_owner uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'title',p.title,'revision',p.edit_version,'brief',r.brief,'referenceText',r.reference_text,
  'targetDurationMs',r.target_duration_ms,'audienceLevel',r.audience_level,'tone',r.tone,'settings',r.settings,
  'status','draft','createdAt',p.created_at,'updatedAt',p.updated_at)
 from public.projects p join public.project_revisions r on (r.owner_id,r.project_id,r.revision)=(p.owner_id,p.id,p.edit_version)
 where p.id=p_id and p.owner_id=p_owner and p.deleted_at is null;
$$;

create function private.append_project_snapshot(p_id uuid,p_owner uuid,p_revision integer,p_doc jsonb) returns void language sql set search_path='' as $$
 insert into public.project_revisions(owner_id,project_id,revision,title,brief,reference_text,target_duration_ms,audience_level,tone,settings,content_hash)
 values(p_owner,p_id,p_revision,p_doc->>'title',p_doc->>'brief',p_doc->>'referenceText',(p_doc->>'targetDurationMs')::integer,p_doc->>'audienceLevel',p_doc->>'tone',
  '{"voice":"female","captions":true,"theme":"topic"}'::jsonb,encode(extensions.digest(p_doc::text,'sha256'),'hex'));
$$;

create function public.get_idea_project(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_result jsonb;
begin
 v_owner := private.active_project_owner();
 v_result := private.project_document(p_id,v_owner);
 if v_result is null then raise exception using message='RESOURCE_NOT_FOUND'; end if;
 return v_result;
end;
$$;

create function public.list_idea_projects(p_limit integer default 21,p_before_at timestamptz default null,p_before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
 v_owner := private.active_project_owner();
 if p_limit is null or p_limit not between 1 and 51 or (p_before_at is null)<>(p_before_id is null) then raise exception using message='VALIDATION_FAILED'; end if;
 return coalesce((select jsonb_agg(private.project_document(p.id,v_owner) order by p.updated_at desc,p.id desc) from
  (select id,updated_at from public.projects where owner_id=v_owner and deleted_at is null
   and (p_before_at is null or (updated_at,id)<(p_before_at,p_before_id)) order by updated_at desc,id desc limit p_limit) p),'[]'::jsonb);
end;
$$;

create function public.create_idea_project(p_command jsonb,p_command_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_id uuid; v_doc jsonb; v_hash text; v_cached private.project_commands%rowtype; v_response jsonb;
begin
 v_owner := private.active_project_owner();
 if p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception using message='VALIDATION_FAILED'; end if;
 v_doc := private.validate_project_fields(p_command);
 v_hash := encode(extensions.digest(v_doc::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':create:'||p_command_key,0));
 select * into v_cached from private.project_commands where owner_id=v_owner and operation='create' and command_key=p_command_key;
 if found and v_cached.expires_at>now() then
  if v_cached.request_hash<>v_hash then raise exception using message='IDEMPOTENCY_CONFLICT'; end if;
  return v_cached.response;
 end if;
 delete from private.project_commands where owner_id=v_owner and operation='create' and command_key=p_command_key;
 insert into public.projects(owner_id,title) values(v_owner,v_doc->>'title') returning id into v_id;
 perform private.append_project_snapshot(v_id,v_owner,1,v_doc);
 v_response := private.project_document(v_id,v_owner);
 insert into private.project_commands(owner_id,operation,command_key,request_hash,response) values(v_owner,'create',p_command_key,v_hash,v_response);
 return v_response;
end;
$$;

create function public.save_idea_project(p_id uuid,p_command jsonb,p_command_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_version integer; v_doc jsonb; v_current jsonb; v_hash text; v_operation text; v_cached private.project_commands%rowtype; v_response jsonb;
begin
 v_owner := private.active_project_owner();
 if p_id is null or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' or p_command is null or jsonb_typeof(p_command)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' then raise exception using message='VALIDATION_FAILED'; end if;
 if (p_command->>'expectedRevision')::numeric not between 1 and 2147483646 or trunc((p_command->>'expectedRevision')::numeric)<>(p_command->>'expectedRevision')::numeric
  or (select count(*) from jsonb_object_keys(p_command))<2 then raise exception using message='VALIDATION_FAILED'; end if;
 -- Validate fields even when called directly through the Data API.
 perform private.validate_project_fields(p_command-'expectedRevision');
 v_operation := 'save:'||p_id::text;
 v_hash := encode(extensions.digest(p_command::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_operation||':'||p_command_key,0));
 select * into v_cached from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 if found and v_cached.expires_at>now() then
  if v_cached.request_hash<>v_hash then raise exception using message='IDEMPOTENCY_CONFLICT'; end if;
  return v_cached.response;
 end if;
 select edit_version into v_version from public.projects where id=p_id and owner_id=v_owner and deleted_at is null for update;
 if not found then raise exception using message='RESOURCE_NOT_FOUND'; end if;
 if v_version<>(p_command->>'expectedRevision')::integer then raise exception using message='REVISION_CONFLICT',detail=v_version::text; end if;
 v_current := private.project_document(p_id,v_owner);
 v_doc := private.validate_project_fields(jsonb_build_object('title',v_current->'title','brief',v_current->'brief','referenceText',v_current->'referenceText','targetDurationMs',v_current->'targetDurationMs','audienceLevel',v_current->'audienceLevel','tone',v_current->'tone')||(p_command-'expectedRevision'));
 perform private.append_project_snapshot(p_id,v_owner,v_version+1,v_doc);
 update public.projects set title=v_doc->>'title',edit_version=v_version+1,updated_at=clock_timestamp() where id=p_id and owner_id=v_owner;
 v_response := private.project_document(p_id,v_owner);
 delete from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 insert into private.project_commands(owner_id,operation,command_key,request_hash,response) values(v_owner,v_operation,p_command_key,v_hash,v_response);
 return v_response;
end;
$$;

revoke all on function private.active_project_owner(),private.validate_project_fields(jsonb),private.project_document(uuid,uuid),private.append_project_snapshot(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.get_idea_project(uuid),public.list_idea_projects(integer,timestamptz,uuid),public.create_idea_project(jsonb,text),public.save_idea_project(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.get_idea_project(uuid),public.list_idea_projects(integer,timestamptz,uuid),public.create_idea_project(jsonb,text),public.save_idea_project(uuid,jsonb,text) to authenticated;
commit;
