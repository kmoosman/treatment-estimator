-- Shared request budgets work across Edge Function instances without storing
-- IP addresses: one project-wide creation key and one write key per existing event.
create table public.schedule_request_limits (
  bucket_key text primary key check (bucket_key ~ '^[A-Za-z0-9:_-]{1,120}$'),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 1 and 86400),
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);

create index schedule_request_limits_expiry_idx
  on public.schedule_request_limits (expires_at);

alter table public.schedule_request_limits enable row level security;
alter table public.schedule_request_limits force row level security;
revoke all on table public.schedule_request_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_request_limits to service_role;

create function public.consume_schedule_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_allowed boolean;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9:_-]{1,120}$'
    or p_limit is null or p_limit not between 1 and 100000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400
  then
    raise exception 'Invalid request-limit settings' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  -- Bound maintenance work even if future callers introduce more bucket keys.
  delete from public.schedule_request_limits
  where bucket_key in (
    select bucket_key from public.schedule_request_limits
    where expires_at < v_now - interval '1 day'
    order by expires_at
    limit 100
    for update skip locked
  );

  insert into public.schedule_request_limits as bucket
    (bucket_key, window_start, window_seconds, request_count, expires_at)
  values (
    p_key, v_window_start, p_window_seconds, 1,
    v_window_start + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket_key) do update
  set
    window_start = case
      when bucket.window_seconds = excluded.window_seconds
        then greatest(bucket.window_start, excluded.window_start)
      else excluded.window_start
    end,
    window_seconds = excluded.window_seconds,
    request_count = case
      when bucket.window_start < excluded.window_start
        or bucket.window_seconds <> excluded.window_seconds then 1
      else bucket.request_count + 1
    end,
    expires_at = case
      when bucket.window_seconds = excluded.window_seconds
        then greatest(bucket.expires_at, excluded.expires_at)
      else excluded.expires_at
    end
  where bucket.window_start < excluded.window_start
    or bucket.window_seconds <> excluded.window_seconds
    or bucket.request_count < p_limit
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.consume_schedule_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_schedule_limit(text, integer, integer)
  to service_role;

comment on function public.consume_schedule_limit(text, integer, integer) is
  'Atomically consume a fixed-window server request budget; false means exhausted.';

notify pgrst, 'reload schema';
