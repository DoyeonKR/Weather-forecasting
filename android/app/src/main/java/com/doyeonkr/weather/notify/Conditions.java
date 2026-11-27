package com.doyeonkr.weather.notify;

import java.util.Map;

/**
 * 조건 알림 — 서버(weather-push 의 runRain)와 같은 기준·문구.
 *  · 비 시작: 지금은 안 오는데 앞으로 약 1시간(15분 칸 5개) 안에 비·눈 → "곧 비 소식" (6시간에 한 번)
 *    서버는 기상청 초단기예보(키 필요)를 쓰지만 앱은 웹 "곧 비가 올까"(lib/rainSoon.ts)와 같은 Open-Meteo 15분 예보를 쓴다.
 *  · 미세먼지: 지금 시각 등급이 나쁨(2) 이상 (하루 한 번)
 *  · 폭염·한파: 오늘 낮 최고 33° 이상 / 아침 최저 -5° 이하 (하루 한 번)
 * 안드로이드 의존 없음 — ConditionsTest.
 */
public final class Conditions {
    private Conditions() {}

    /** 15분 강수 mm — 이보다 적으면 비로 세지 않는다 (lib/rainSoon.ts THRESH 와 같다) */
    static final double THRESH = 0.1;
    /** 앞으로 볼 15분 칸 수 — 서버가 보는 "약 10분·70분 뒤" 두 칸과 비슷한 1시간 15분 */
    static final int AHEAD = 5;
    static final double HOT_MAX = 33, COLD_MIN = -5;

    /** 곧 오는 비·눈: 시작 칸 시각(epoch 초)과 눈인지. 지금 이미 오거나 안 오면 null */
    public static final class Soon {
        public final long startSec;
        public final boolean snow;

        Soon(long startSec, boolean snow) {
            this.startSec = startSec;
            this.snow = snow;
        }
    }

    /**
     * @param times    15분 칸 시작 시각(epoch 초), 오름차순
     * @param precip   그 칸 강수 mm
     * @param snowfall 그 칸 적설 cm (없으면 null — 비로 본다)
     */
    public static Soon rainSoon(long[] times, double[] precip, double[] snowfall, long nowSec) {
        if (times == null || precip == null || times.length == 0 || times.length != precip.length) return null;
        int cur = -1;
        for (int i = 0; i < times.length; i++) if (times[i] <= nowSec) cur = i;
        if (cur < 0) return null;
        if (precip[cur] >= THRESH) return null; // 이미 오고 있으면 알릴 필요가 없다 (서버와 같다)
        for (int i = cur + 1; i <= Math.min(times.length - 1, cur + AHEAD); i++) {
            if (precip[i] >= THRESH) {
                boolean snow = snowfall != null && i < snowfall.length && snowfall[i] > 0;
                return new Soon(times[i], snow);
            }
        }
        return null;
    }

    /** 미세먼지 등급 0 좋음 ~ 3 매우 나쁨 (서버 fetchAirNow 와 같은 구간) */
    public static int airGrade(double pm10, double pm25) {
        int g10 = pm10 <= 30 ? 0 : pm10 <= 80 ? 1 : pm10 <= 150 ? 2 : 3;
        int g25 = pm25 <= 15 ? 0 : pm25 <= 35 ? 1 : pm25 <= 75 ? 2 : 3;
        return Math.max(g10, g25);
    }

    /** 🌂 곧 비 소식 (서버와 같은 문장, "비나 눈"은 앱 예보로 가릴 수 없어 비·눈 둘만) */
    public static Brief.Msg rainMsg(String place, int hour, boolean snow, Map<String, String> lines) {
        String kind = snow ? "눈" : "비";
        return new Brief.Msg("🌂 " + place + " 곧 " + kind + " 소식",
            hour + "시쯤부터 " + (snow ? "눈이" : "비가") + " 올 것 같아요. " + Brief.say(lines, snow ? "snow" : "umbrella"));
    }

    /** 😷 미세먼지 나쁨 — 등급 2 미만이면 null */
    public static Brief.Msg airMsg(String place, int grade, Map<String, String> lines) {
        if (grade < 2) return null;
        return new Brief.Msg("😷 " + place + " 미세먼지 " + (grade >= 3 ? "매우 나쁨" : "나쁨"), Brief.say(lines, "mask"));
    }

    /** 🥵 폭염 / 🥶 한파 — 둘 다 아니면 null (둘 다면 서버처럼 폭염 먼저) */
    public static Brief.Msg tempMsg(String place, Brief.Day today, Map<String, String> lines) {
        if (today.tmax >= HOT_MAX) return new Brief.Msg("🥵 " + place + " 오늘 폭염", "낮 최고 " + Brief.num(Brief.r1(today.tmax)) + "°. " + Brief.say(lines, "hot"));
        if (today.tmin <= COLD_MIN) return new Brief.Msg("🥶 " + place + " 오늘 한파", "아침 최저 " + Brief.num(Brief.r1(today.tmin)) + "°. " + Brief.say(lines, "cold"));
        return null;
    }

    /** 조건 알림을 보내는 시간 (서버 크론과 같은 07~21시) */
    public static boolean awakeHour(int hour) {
        return hour >= 7 && hour <= 21;
    }
}
