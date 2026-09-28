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
