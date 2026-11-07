-- M3c3: saved draft preferences; no provider voice selection or user defaults.
begin;
create or replace function private.validate_project_fields(p_data jsonb) returns jsonb language plpgsql set search_path='' as $$
declare v jsonb; s jsonb;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('title','brief','referenceText','targetDurationMs','audienceLevel','tone','settings')) then raise exception using message='VALIDATION_FAILED'; end if;
 s := coalesce(p_data->'settings','{}'::jsonb);
 if jsonb_typeof(s)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if exists(select 1 from jsonb_object_keys(s) k where k not in ('voice','captions','theme')) then raise exception using message='VALIDATION_FAILED'; end if;
 s := '{"voice":"female","captions":true,"theme":"topic"}'::jsonb || s;
 if jsonb_typeof(s->'voice')<>'string' or s->>'voice' not in ('male','female') or s->'captions'<>'true'::jsonb or s->'theme'<>'"topic"'::jsonb then raise exception using message='VALIDATION_FAILED'; end if;
 v := jsonb_build_object('title','Untitled idea','brief','','referenceText','','targetDurationMs',60000,'audienceLevel','beginner','tone','clear') || p_data;
 if jsonb_typeof(v->'title')<>'string' or jsonb_typeof(v->'brief')<>'string' or jsonb_typeof(v->'referenceText')<>'string'
  or jsonb_typeof(v->'audienceLevel')<>'string' or jsonb_typeof(v->'tone')<>'string' or jsonb_typeof(v->'targetDurationMs')<>'number' then raise exception using message='VALIDATION_FAILED'; end if;
 if length(btrim(v->>'title')) not between 1 and 140 or length(v->>'brief')>6000 or length(v->>'referenceText')>20000
  or (v->>'targetDurationMs')::numeric not in (30000,60000,90000) or v->>'audienceLevel' not in ('beginner','intermediate','advanced') or v->>'tone' not in ('clear','conversational','direct') then raise exception using message='VALIDATION_FAILED'; end if;
 return jsonb_set(jsonb_set(v,'{title}',to_jsonb(btrim(v->>'title'))),'{settings}',s);
end;
$$;

create or replace function private.append_project_snapshot(p_id uuid,p_owner uuid,p_revision integer,p_doc jsonb) returns void language sql set search_path='' as $$
 insert into public.project_revisions(owner_id,project_id,revision,title,brief,reference_text,target_duration_ms,audience_level,tone,settings,content_hash)
 values(p_owner,p_id,p_revision,p_doc->>'title',p_doc->>'brief',p_doc->>'referenceText',(p_doc->>'targetDurationMs')::integer,p_doc->>'audienceLevel',p_doc->>'tone',
  p_doc->'settings',encode(extensions.digest(p_doc::text,'sha256'),'hex'));
$$;

create or replace function public.create_idea_project(p_command jsonb,p_command_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_id uuid; v_doc jsonb; v_hash text; v_cached private.project_commands%rowtype; v_response jsonb;
begin
 v_owner := private.active_project_owner();
 if p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception using message='VALIDATION_FAILED'; end if;
 v_doc := private.validate_project_fields(p_command);
 -- Preserve pre-M3c3 create keys whose normalized input had no settings.
 v_hash := encode(extensions.digest((case when p_command ? 'settings' then v_doc else v_doc-'settings' end)::text,'sha256'),'hex');
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

create or replace function public.save_idea_project(p_id uuid,p_command jsonb,p_command_key text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 v_doc := private.validate_project_fields(jsonb_build_object('title',v_current->'title','brief',v_current->'brief','referenceText',v_current->'referenceText','targetDurationMs',v_current->'targetDurationMs','audienceLevel',v_current->'audienceLevel','tone',v_current->'tone','settings',(v_current->'settings')||coalesce(p_command->'settings','{}'::jsonb))||(p_command-'expectedRevision'-'settings'));
 perform private.append_project_snapshot(p_id,v_owner,v_version+1,v_doc);
 update public.projects set title=v_doc->>'title',edit_version=v_version+1,updated_at=clock_timestamp() where id=p_id and owner_id=v_owner;
 v_response := private.project_document(p_id,v_owner);
 delete from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 insert into private.project_commands(owner_id,operation,command_key,request_hash,response) values(v_owner,v_operation,p_command_key,v_hash,v_response);
 return v_response;
end;
$$;

revoke all on function private.validate_project_fields(jsonb),private.append_project_snapshot(uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.create_idea_project(jsonb,text),public.save_idea_project(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.create_idea_project(jsonb,text),public.save_idea_project(uuid,jsonb,text) to authenticated;
commit;
