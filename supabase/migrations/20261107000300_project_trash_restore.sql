begin;
create index projects_trash_idx on public.projects(owner_id,updated_at desc,id desc) where deleted_at is not null;

create function private.transition_idea_project(p_id uuid,p_command jsonb,p_command_key text,p_restore boolean)
returns jsonb language plpgsql set search_path='' as $$
declare
 v_owner uuid; v_project public.projects%rowtype; v_operation text; v_hash text;
 v_cached private.project_commands%rowtype; v_response jsonb; v_deleted timestamptz;
begin
 v_owner := private.active_project_owner();
 if p_id is null or p_restore is null or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$'
  or p_command is null or jsonb_typeof(p_command)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if (select count(*) from jsonb_object_keys(p_command))<>1
  or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' then raise exception using message='VALIDATION_FAILED'; end if;
 if (p_command->>'expectedRevision')::numeric not between 1 and 2147483646
  or trunc((p_command->>'expectedRevision')::numeric)<>(p_command->>'expectedRevision')::numeric then raise exception using message='VALIDATION_FAILED'; end if;
 v_operation := (case when p_restore then 'restore:' else 'trash:' end)||p_id::text;
 v_hash := encode(extensions.digest(p_command::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_operation||':'||p_command_key,0));
 select * into v_cached from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 if found and v_cached.expires_at>now() then
  if v_cached.request_hash<>v_hash then raise exception using message='IDEMPOTENCY_CONFLICT'; end if;
  return v_cached.response;
 end if;
 select * into v_project from public.projects where id=p_id and owner_id=v_owner for update;
 if not found or (p_restore and v_project.deleted_at is null) or (not p_restore and v_project.deleted_at is not null)
  then raise exception using message='RESOURCE_NOT_FOUND'; end if;
 if v_project.edit_version<>(p_command->>'expectedRevision')::integer then raise exception using message='REVISION_CONFLICT',detail=v_project.edit_version::text; end if;
 -- Lifecycle transitions advance the same concurrency counter as authoring.
 -- This fences old autosaves even after the project has been restored.
 insert into public.project_revisions(owner_id,project_id,revision,title,brief,reference_text,target_duration_ms,audience_level,tone,settings,content_hash)
 select owner_id,project_id,v_project.edit_version+1,title,brief,reference_text,target_duration_ms,audience_level,tone,settings,content_hash
 from public.project_revisions where owner_id=v_owner and project_id=p_id and revision=v_project.edit_version;
 if not found then raise exception using message='RESOURCE_NOT_FOUND'; end if;
 v_deleted := case when p_restore then null else clock_timestamp() end;
 update public.projects set edit_version=v_project.edit_version+1,deleted_at=v_deleted,updated_at=clock_timestamp() where id=p_id and owner_id=v_owner;
 if p_restore then v_response := private.project_document(p_id,v_owner);
 else v_response := jsonb_build_object('id',p_id,'revision',v_project.edit_version+1,'status','trashed','deletedAt',v_deleted); end if;
 delete from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 insert into private.project_commands(owner_id,operation,command_key,request_hash,response) values(v_owner,v_operation,p_command_key,v_hash,v_response);
 return v_response;
end;
$$;
create function public.trash_idea_project(p_id uuid,p_command jsonb,p_command_key text)
returns jsonb language sql security definer set search_path='' as $$
 select private.transition_idea_project(p_id,p_command,p_command_key,false);
$$;
create function public.restore_idea_project(p_id uuid,p_command jsonb,p_command_key text)
returns jsonb language sql security definer set search_path='' as $$
 select private.transition_idea_project(p_id,p_command,p_command_key,true);
$$;
create function public.list_trashed_idea_projects(p_limit integer default 21,p_before_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
 v_owner := private.active_project_owner();
 if p_limit is null or p_limit not between 1 and 51 or (p_before_at is null)<>(p_before_id is null) then raise exception using message='VALIDATION_FAILED'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.title,'revision',p.edit_version,'deletedAt',p.deleted_at,'updatedAt',p.updated_at) order by p.updated_at desc,p.id desc)
  from (select id,title,edit_version,deleted_at,updated_at from public.projects where owner_id=v_owner and deleted_at is not null
   and (p_before_at is null or (updated_at,id)<(p_before_at,p_before_id)) order by updated_at desc,id desc limit p_limit) p),'[]'::jsonb);
end;
$$;
revoke all on function private.transition_idea_project(uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.trash_idea_project(uuid,jsonb,text),public.restore_idea_project(uuid,jsonb,text),public.list_trashed_idea_projects(integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.trash_idea_project(uuid,jsonb,text),public.restore_idea_project(uuid,jsonb,text),public.list_trashed_idea_projects(integer,timestamptz,uuid) to authenticated;
commit;
