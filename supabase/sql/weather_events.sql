-- 기능 사용 집계 (v1.0.63)
-- 방문 집계(weather_page_views)와 같은 원칙: anon 은 기록(insert)만, 조회는 대시보드에서만.
-- 이름 목록은 src/lib/track.ts 의 EventName 과 맞춘다. 목록 밖 이름·큰 props 는 DB 가 거절한다.

create table if not exists public.weather_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id text not null check (length(session_id) between 4 and 64),
  name text not null check (name in (
    'share', 'share_done', 'search', 'place_select', 'notify_on', 'notify_off',
    'rain_alert_on', 'rain_alert_off', 'refresh', 'feel_vote', 'hourly_scroll', 'commute_set'
  )),
  props jsonb check (props is null or (jsonb_typeof(props) = 'object' and pg_column_size(props) < 512))
);

create index if not exists weather_events_created_idx on public.weather_events (created_at);

alter table public.weather_events enable row level security;
drop policy if exists we_insert on public.weather_events;
create policy we_insert on public.weather_events for insert to anon with check (true);
revoke all on public.weather_events from anon, authenticated;
grant insert on public.weather_events to anon;

-- 조회 예시 (대시보드 SQL 편집기)
-- select date_trunc('day', created_at at time zone 'Asia/Seoul') as day, name, count(*), count(distinct session_id)
--   from public.weather_events group by 1, 2 order by 1 desc, 3 desc;

-- 요약 (v1.0.64) — 날짜·이름별 건수와 사람 수만. 앱의 #stats 화면이 쓴다.
-- 방문(weather_page_views)도 'visit' 로 같이 돌려준다. 개별 행·세션 id 는 내보내지 않는다.
create or replace function public.weather_events_summary(p_days integer default 14)
returns table (day date, name text, events bigint, people bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  with since as (select (now() at time zone 'Asia/Seoul')::date - greatest(1, least(coalesce(p_days, 14), 60)) + 1 as d)
  select (e.created_at at time zone 'Asia/Seoul')::date as day, e.name, count(*) as events, count(distinct e.session_id) as people
    from public.weather_events e, since
   where (e.created_at at time zone 'Asia/Seoul')::date >= since.d
   group by 1, 2
  union all
  select (v.at at time zone 'Asia/Seoul')::date as day, 'visit' as name, count(*) as events, count(distinct v.session_id) as people
    from public.weather_page_views v, since
   where (v.at at time zone 'Asia/Seoul')::date >= since.d
   group by 1
  order by 1 desc, 4 desc
$$;

revoke all on function public.weather_events_summary(integer) from public;
grant execute on function public.weather_events_summary(integer) to anon;

-- 보관 기간 (v1.0.66): 180일이 지난 기능 사용 기록은 매주 지운다 (일요일 18:15 UTC = 월요일 03:15 KST).
-- select cron.schedule('weather-events-purge', '15 18 * * 0',
--   $$delete from public.weather_events where created_at < now() - interval '180 days'$$);
