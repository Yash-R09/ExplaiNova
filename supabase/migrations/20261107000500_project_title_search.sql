begin;
-- Keep existing no-query list RPC signatures for older app versions/cursors.
-- strpos treats %, _ and backslash literally; this is not a LIKE pattern.
create function public.search_idea_projects(p_query text,p_trashed boolean default false,p_limit integer default 21,p_before_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_query text;
begin
 v_owner := private.active_project_owner();
 if p_query is null or length(p_query)>140 or p_trashed is null or p_limit is null or p_limit not between 1 and 51
  or (p_before_at is null)<>(p_before_id is null) then raise exception using message='VALIDATION_FAILED'; end if;
 v_query := btrim(p_query);
 if v_query ~ '[[:cntrl:]]' then raise exception using message='VALIDATION_FAILED'; end if;
 return coalesce((select jsonb_agg(case when p_trashed then
   jsonb_build_object('id',p.id,'title',p.title,'revision',p.edit_version,'deletedAt',p.deleted_at,'updatedAt',p.updated_at)
   else private.project_document(p.id,v_owner) end order by p.updated_at desc,p.id desc)
  from (select id,title,edit_version,deleted_at,updated_at from public.projects
   where owner_id=v_owner and (deleted_at is not null)=p_trashed
    and strpos(lower(title),lower(v_query))>0
    and (p_before_at is null or (updated_at,id)<(p_before_at,p_before_id))
   order by updated_at desc,id desc limit p_limit) p),'[]'::jsonb);
end;
$$;
revoke all on function public.search_idea_projects(text,boolean,integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.search_idea_projects(text,boolean,integer,timestamptz,uuid) to authenticated;
commit;
