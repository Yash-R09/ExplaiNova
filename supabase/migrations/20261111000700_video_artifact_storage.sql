begin;

alter table private.outbox_events add column render_artifacts jsonb
  check (render_artifacts is null or jsonb_typeof(render_artifacts) = 'object');
alter table private.outbox_events add column render_sha256 text
  check (render_sha256 is null or render_sha256 ~ '^[0-9a-f]{64}$');

create function public.record_video_render(p_job_id uuid, p_content_hash text, p_video_sha256 text)
returns boolean language sql security definer set search_path = '' as $$
  with recorded as (
    update private.outbox_events event set render_sha256 = p_video_sha256
    from public.generation_jobs job
    where event.job_id = p_job_id and job.id = event.job_id and job.status = 'queued'
      and job.assembly_ready_at is not null
      and event.assembly_manifest->>'contentHash' = p_content_hash
      and p_video_sha256 ~ '^[0-9a-f]{64}$'
      and (event.render_sha256 is null or event.render_sha256 = p_video_sha256)
    returning event.id
  )
  select exists (select 1 from recorded);
$$;

create function public.read_video_storage_inputs(p_job_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'durationFrames', event.assembly_manifest->'durationFrames',
    'srt', event.assembly_manifest->'srt',
    'videoSha256', event.render_sha256,
    'complete', job.status = 'succeeded'
  )
  from public.generation_jobs job
  join private.outbox_events event on event.job_id = job.id
  where job.id = p_job_id and job.assembly_ready_at is not null and event.assembly_manifest is not null
    and (job.status = 'queued' or (job.status = 'succeeded' and event.render_artifacts is not null));
$$;

create function public.complete_video_storage(
  p_job_id uuid, p_bucket text, p_video_sha256 text, p_video_bytes bigint, p_srt_sha256 text, p_srt_bytes bigint
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_event private.outbox_events%rowtype;
  v_srt bytea;
  v_prefix text := 'video-jobs/' || p_job_id::text || '/';
  v_artifacts jsonb;
begin
  if coalesce(p_bucket, '') !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'
    or coalesce(p_video_sha256, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_srt_sha256, '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_video_bytes, 0) not between 1 and 268435456
    or coalesce(p_srt_bytes, 0) not between 1 and 131072 then return false; end if;

  select * into v_event from private.outbox_events where job_id = p_job_id for update;
  if not found or v_event.assembly_manifest is null
    or v_event.render_sha256 is distinct from p_video_sha256 then return false; end if;
  v_srt := convert_to(v_event.assembly_manifest->>'srt', 'UTF8');
  if coalesce(v_event.assembly_manifest->>'durationFrames', '') not in ('900', '1800', '2700')
    or octet_length(v_srt) is distinct from p_srt_bytes
    or encode(sha256(v_srt), 'hex') is distinct from p_srt_sha256 then return false; end if;

  v_artifacts := jsonb_build_object(
    'bucket', p_bucket,
    'video', jsonb_build_object('key', v_prefix || p_video_sha256 || '.mp4',
      'sha256', p_video_sha256, 'sizeBytes', p_video_bytes, 'contentType', 'video/mp4'),
    'captions', jsonb_build_object('key', v_prefix || p_srt_sha256 || '.srt',
      'sha256', p_srt_sha256, 'sizeBytes', p_srt_bytes, 'contentType', 'application/x-subrip')
  );
  if v_event.render_artifacts is not null then return v_event.render_artifacts = v_artifacts; end if;

  update public.generation_jobs set status = 'succeeded'
    where id = p_job_id and status = 'queued' and assembly_ready_at is not null;
  if not found then return false; end if;
  update private.outbox_events set render_artifacts = v_artifacts, dispatched_at = coalesce(dispatched_at, clock_timestamp())
    where id = v_event.id;
  return true;
end;
$$;

revoke all on function public.record_video_render(uuid,text,text), public.read_video_storage_inputs(uuid),
  public.complete_video_storage(uuid,text,text,bigint,text,bigint) from public, anon, authenticated, service_role;
grant execute on function public.record_video_render(uuid,text,text), public.read_video_storage_inputs(uuid),
  public.complete_video_storage(uuid,text,text,bigint,text,bigint) to service_role;

commit;
