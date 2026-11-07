begin;

-- Copy one acknowledged source revision atomically. Browser-only pending edits
-- and future approvals/jobs/outputs/connections are deliberately not copied.
create function public.duplicate_idea_project(p_id uuid,p_command jsonb,p_command_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid; v_version integer; v_id uuid; v_current jsonb; v_doc jsonb;
 v_operation text; v_hash text; v_cached private.project_commands%rowtype; v_response jsonb;
 v_title text := 'Copy of '; v_character text; v_units integer := 8; v_size integer;
begin
 v_owner := private.active_project_owner();
 if p_id is null or p_command_key is null or p_command_key !~ '^[A-Za-z0-9_-]{16,128}$'
  or p_command is null or jsonb_typeof(p_command)<>'object' then raise exception using message='VALIDATION_FAILED'; end if;
 if (select count(*) from jsonb_object_keys(p_command))<>1
  or jsonb_typeof(p_command->'expectedRevision') is distinct from 'number' then raise exception using message='VALIDATION_FAILED'; end if;
 if (p_command->>'expectedRevision')::numeric not between 1 and 2147483647
  or trunc((p_command->>'expectedRevision')::numeric)<>(p_command->>'expectedRevision')::numeric then raise exception using message='VALIDATION_FAILED'; end if;
 v_operation := 'duplicate:'||p_id::text;
 v_hash := encode(extensions.digest(p_command::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':'||v_operation||':'||p_command_key,0));
 select * into v_cached from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 if found and v_cached.expires_at>now() then
  if v_cached.request_hash<>v_hash then raise exception using message='IDEMPOTENCY_CONFLICT'; end if;
  return v_cached.response;
 end if;
 select edit_version into v_version from public.projects where id=p_id and owner_id=v_owner and deleted_at is null for share;
 if not found then raise exception using message='RESOURCE_NOT_FOUND'; end if;
 if v_version<>(p_command->>'expectedRevision')::integer then raise exception using message='REVISION_CONFLICT',detail=v_version::text; end if;
 v_current := private.project_document(p_id,v_owner);
 -- Respect the browser's 140 UTF-16-unit limit without splitting a Unicode
 -- character when prefixing a long title (Postgres length counts codepoints).
 for v_character in select regexp_split_to_table(v_current->>'title','') loop
  v_size := case when ascii(v_character)>65535 then 2 else 1 end;
  exit when v_units+v_size>140;
  v_title := v_title||v_character; v_units := v_units+v_size;
 end loop;
 v_title := btrim(v_title);
 v_doc := jsonb_build_object('title',v_title,'brief',v_current->'brief','referenceText',v_current->'referenceText',
  'targetDurationMs',v_current->'targetDurationMs','audienceLevel',v_current->'audienceLevel','tone',v_current->'tone','settings',v_current->'settings');
 insert into public.projects(owner_id,title) values(v_owner,v_title) returning id into v_id;
 insert into public.project_revisions(owner_id,project_id,revision,title,brief,reference_text,target_duration_ms,audience_level,tone,settings,content_hash)
 values(v_owner,v_id,1,v_title,v_doc->>'brief',v_doc->>'referenceText',(v_doc->>'targetDurationMs')::integer,v_doc->>'audienceLevel',v_doc->>'tone',v_doc->'settings',encode(extensions.digest(v_doc::text,'sha256'),'hex'));
 v_response := private.project_document(v_id,v_owner);
 delete from private.project_commands where owner_id=v_owner and operation=v_operation and command_key=p_command_key;
 insert into private.project_commands(owner_id,operation,command_key,request_hash,response) values(v_owner,v_operation,p_command_key,v_hash,v_response);
 return v_response;
end;
$$;
revoke all on function public.duplicate_idea_project(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.duplicate_idea_project(uuid,jsonb,text) to authenticated;
commit;
