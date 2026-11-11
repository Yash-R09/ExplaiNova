begin;

alter table private.outbox_events add column narration_manifest jsonb
  check (narration_manifest is null or jsonb_typeof(narration_manifest) = 'object');
alter table public.generation_jobs add column narration_ready_at timestamptz;

create function public.complete_video_narration(p_job_id uuid, p_lease_token uuid, p_manifest jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_event private.outbox_events%rowtype;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object' or pg_column_size(p_manifest) > 65536 then return false; end if;
  select * into v_event from private.outbox_events where job_id = p_job_id for update;
  if not found or p_lease_token is null or v_event.lease_token is distinct from p_lease_token
    or v_event.dispatched_at is not null or v_event.lease_expires_at <= clock_timestamp() then return false; end if;
  perform 1 from public.generation_jobs where id = p_job_id and status = 'running' for update;
  if not found or v_event.lease_expires_at <= clock_timestamp() then return false; end if;

  update public.generation_jobs set status = 'queued', narration_ready_at = clock_timestamp() where id = p_job_id;
  update private.outbox_events set narration_manifest = p_manifest, dispatched_at = clock_timestamp(),
    lease_token = null, lease_expires_at = null where id = v_event.id;
  return true;
end;
$$;

revoke all on function public.complete_video_narration(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.complete_video_narration(uuid,uuid,jsonb) to service_role;
commit;
