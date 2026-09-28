-- 웹푸시 구독 테이블 스키마와 접근 경로
-- 기록 이유: 앱이 전제하는 제약(endpoint UNIQUE)과 권한이 코드 어디에도 없어서,
-- 대시보드를 열어보기 전에는 확인할 수 없는 상태였다.
--
-- 실제 구조 (2026-08 확인)
--   id           bigint  PRIMARY KEY (자동 생성)
--   created_at   timestamptz not null default now()
--   endpoint     text    not null UNIQUE  <- 충돌 판정 기준
--   p256dh       text    not null
--   auth         text    not null
--   lat, lon     double precision not null
--   label        text
--   night_time   text    not null default '2130'
--   morning_time text    not null default '0730'
--
-- 기본키가 id 라서, PostgREST 업서트에 on_conflict 를 주지 않으면 충돌 대상이 id 가 되고
-- endpoint UNIQUE 를 위반해 409 가 난다. 즉 이미 알림을 켠 사람은 시간 변경이 항상 실패한다.
-- 그렇다고 anon 에 UPDATE 정책을 열면 endpoint 만 알면 남의 알림 지역을 덮어쓸 수 있다.
-- 그래서 테이블 직접 접근을 닫고, 필요한 두 동작만 함수로 노출한다.

-- 구독 저장 (신규 등록 + 시간/지역 변경)
create or replace function public.weather_push_save(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_lat double precision,
  p_lon double precision,
  p_label text,
  p_night_time text,
  p_morning_time text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_endpoint is null or length(p_endpoint) < 20 or length(p_endpoint) > 700 then
    raise exception 'invalid endpoint';
  end if;
  if p_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;
  if p_p256dh is null or length(p_p256dh) > 200 or p_auth is null or length(p_auth) > 200 then
    raise exception 'invalid keys';
  end if;
  if p_lat is null or p_lat < -90 or p_lat > 90 or p_lon is null or p_lon < -180 or p_lon > 180 then
    raise exception 'invalid coordinates';
  end if;
  if p_night_time !~ '^[0-2][0-9][0-5][0-9]$' or p_morning_time !~ '^[0-2][0-9][0-5][0-9]$' then
    raise exception 'invalid time slot';
  end if;

  insert into public.weather_push_subs
    (endpoint, p256dh, auth, lat, lon, label, night_time, morning_time)
  values
    (p_endpoint, p_p256dh, p_auth, p_lat, p_lon, left(coalesce(p_label, ''), 60), p_night_time, p_morning_time)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        lat = excluded.lat,
        lon = excluded.lon,
        label = excluded.label,
        night_time = excluded.night_time,
        morning_time = excluded.morning_time;
end
$$;

-- 구독 해제 (자기 endpoint 한 건만)
create or replace function public.weather_push_remove(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_endpoint is null or length(p_endpoint) < 20 then
    raise exception 'invalid endpoint';
  end if;
  delete from public.weather_push_subs where endpoint = p_endpoint;
end
$$;

revoke all on function public.weather_push_save(text, text, text, double precision, double precision, text, text, text) from public;
revoke all on function public.weather_push_remove(text) from public;
grant execute on function public.weather_push_save(text, text, text, double precision, double precision, text, text, text) to anon;
grant execute on function public.weather_push_remove(text) to anon;

-- 테이블 직접 접근 차단 (v1.0.54 배포 확인 후 적용 완료)
-- 특히 wps_delete 는 using (true) 라 endpoint 없이 조건만 주면
-- 전체 구독을 지울 수 있었다. 이제 위 두 함수로만 들어온다.
drop policy if exists wps_insert on public.weather_push_subs;
drop policy if exists wps_delete on public.weather_push_subs;
revoke all on public.weather_push_subs from anon, authenticated;

-- 방문 집계도 같은 기준으로. 기록만 허용하고 조회는 집계 함수로만.
revoke all on public.weather_page_views from anon, authenticated;
grant insert on public.weather_page_views to anon;
-- 조회는 weather_today_visitors() (security definer) 로만

-- ── 비 시작 알림 (v1.0.63, 2026-09-28 적용) ─────────────────────
-- 켠 사람만 받는다. 기본값 꺼짐이라 기존 구독자에게는 아무것도 바뀌지 않는다.
alter table public.weather_push_subs add column if not exists rain_alert boolean not null default false;
alter table public.weather_push_subs add column if not exists last_rain_alert timestamptz;

-- 자기 endpoint 의 비 알림만 켜고 끈다. 해당 구독이 없으면 false.
create or replace function public.weather_push_set_rain(p_endpoint text, p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_endpoint is null or length(p_endpoint) < 20 or p_on is null then
    raise exception 'invalid input';
  end if;
  update public.weather_push_subs set rain_alert = p_on where endpoint = p_endpoint;
  return found;
end
$$;

revoke all on function public.weather_push_set_rain(text, boolean) from public;
grant execute on function public.weather_push_set_rain(text, boolean) to anon;

-- 크론: KST 07:50~21:50 매시 (UTC 22,23,0~12시 50분). 초단기예보가 매시 45분쯤 나온 직후.
-- 키는 weather-night 잡의 명령에서 그대로 가져와 새로 적지 않는다.
-- select cron.schedule('weather-rain', '50 22,23,0-12 * * *',
--   (select replace(command, 'mode=night', 'mode=rain') from cron.job where jobname = 'weather-night'));
--
-- 점검: weather-push?key=…&probe=위도,경도 → 보내지 않고 판단(실황·예보 두 칸)만 돌려준다.

-- ── 테스트 알림 (v1.0.64) ─────────────────────────────────
-- weather-push-test 함수가 같은 구독에 1분에 한 번만 보내도록 기록한다.
alter table public.weather_push_subs add column if not exists last_test_sent timestamptz;
