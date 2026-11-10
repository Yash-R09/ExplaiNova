begin;

create index planning_requests_owner_recent on public.planning_requests(owner_id, created_at desc);

create function private.enforce_brainstorm_admission_limit()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_now timestamptz;
  v_oldest_counted timestamptz;
begin
  -- Exact command replays return before inserting and do not spend another slot.
  perform pg_advisory_xact_lock(hashtextextended('brainstorm-admission:' || new.owner_id::text, 0));
  v_now := clock_timestamp();
  select created_at into v_oldest_counted
    from public.planning_requests
    where owner_id = new.owner_id and created_at > v_now - interval '1 hour'
    order by created_at desc offset 9 limit 1;
  if found then
    raise exception using message = 'BRAINSTORM_RATE_LIMITED',
      detail = ceil(extract(epoch from v_oldest_counted + interval '1 hour' - v_now))::text;
  end if;
  new.created_at := v_now;
  return new;
end;
$$;

revoke all on function private.enforce_brainstorm_admission_limit() from public, anon, authenticated, service_role;
create trigger enforce_brainstorm_admission_limit before insert on public.planning_requests
  for each row execute function private.enforce_brainstorm_admission_limit();

commit;
