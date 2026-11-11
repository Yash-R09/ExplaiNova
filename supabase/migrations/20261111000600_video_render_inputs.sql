begin;

create function public.read_video_render_inputs(p_job_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select event.assembly_manifest
  from public.generation_jobs job
  join private.outbox_events event on event.job_id = job.id
  where job.id = p_job_id and job.status = 'queued' and job.assembly_ready_at is not null;
$$;

revoke all on function public.read_video_render_inputs(uuid) from public, anon, authenticated, service_role;
grant execute on function public.read_video_render_inputs(uuid) to service_role;

commit;
