begin;

create function private.guard_trash_with_active_video()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- The project update holds the row lock that video admission takes FOR SHARE.
  if exists (
    select 1 from public.generation_jobs
    where owner_id = old.owner_id and project_id = old.id
      and status in ('queued', 'running', 'waiting_retry', 'needs_action', 'cancel_requested')
  ) then
    raise exception using message = 'PROJECT_VIDEO_JOB_ACTIVE';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_trash_with_active_video() from public, anon, authenticated, service_role;
create trigger guard_trash_with_active_video
  before update of deleted_at on public.projects
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.guard_trash_with_active_video();

commit;
