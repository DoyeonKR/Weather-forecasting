package com.doyeonkr.weather.notify;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 알림 문구 — 서버(supabase/functions/weather-push/index.ts 의 morningMsg·nightMsg, weather-push-test)를
 * 한 줄씩 옮긴 것. 문구·기준을 바꾸면 서버 쪽도 같이 바꾼다. 말투 문구는 res/raw/persona_lines.json (persona.ts 에서 생성).
 * 안드로이드 의존 없음 — JUnit 으로 시험한다 (BriefTest).
 */
public final class Brief {
    private Brief() {}

    /** 하루치 예보 (Open-Meteo daily 한 칸) */
    public static final class Day {
        public final double tmax, tmin, uv;
        public final int prob, code;

        public Day(double tmax, double tmin, int prob, int code, double uv) {
            this.tmax = tmax;
            this.tmin = tmin;
            this.prob = prob;
            this.code = code;
            this.uv = uv;
        }
    }

    public static final class Msg {
        public final String title, body;

        public Msg(String title, String body) {
            this.title = title;
            this.body = body;
        }
    }

    public static double r1(double n) {
        return Math.round(n * 10) / 10.0;
    }

    /** 자바스크립트 숫자 표기와 같게: 3 → "3", 3.5 → "3.5", -0 → "0" */
    public static String num(double v) {
        if (v == 0) return "0";
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return String.valueOf(v);
    }

    static boolean isSnow(int c) {
        return (c >= 71 && c <= 77) || c == 85 || c == 86;
    }

    public static String say(Map<String, String> lines, String key) {
        String s = lines == null ? null : lines.get(key);
        return s == null ? "" : s;
    }

    /** 아침 브리핑 (서버 morningMsg) — air: 낮 동안 미세먼지 최악 등급 0~3, 모르면 null */
    public static Msg morning(String place, Day yesterday, Day today, Integer air, Map<String, String> lines) {
        double d = r1(today.tmax - yesterday.tmax);
        String cmp = Math.abs(d) < 1 ? "어제와 비슷해요" : d > 0 ? "어제보다 " + num(d) + "° 높아요" : "어제보다 " + num(Math.abs(d)) + "° 낮아요";
        List<String> parts = new ArrayList<>();
        parts.add("오늘 " + num(r1(today.tmin)) + "~" + num(r1(today.tmax)) + "°, 낮 기온이 " + cmp + ".");
        if (isSnow(today.code)) parts.add(say(lines, "snow"));
        else if (today.prob >= 60) parts.add("강수확률 " + today.prob + "%, " + say(lines, "umbrella"));
        if (air != null && air >= 3) parts.add("미세먼지 매우 나쁨, " + say(lines, "mask"));
        else if (air != null && air >= 2) parts.add("미세먼지 나쁨, " + say(lines, "mask"));
        if (today.uv >= 8) parts.add("자외선 매우 강함, " + say(lines, "uv"));
        return new Msg("☀️ " + place + " 오늘 날씨 브리핑", String.join(" ", parts));
    }

    /** 내일 출근 준비 (서버 nightMsg) — 오늘과 크게 다를 때만, 아니면 null (조용히) */
    public static Msg night(String place, Day today, Day tomorrow, Map<String, String> lines) {
        List<String> parts = new ArrayList<>();
        double dMax = r1(tomorrow.tmax - today.tmax);
        double dMin = r1(tomorrow.tmin - today.tmin);
        if (isSnow(tomorrow.code)) parts.add("내일 눈 소식! " + say(lines, "snow"));
        else if (tomorrow.prob >= 60) parts.add("내일 비 올 확률 " + tomorrow.prob + "%. " + say(lines, "umbrella"));
        if (dMin <= -5) parts.add("내일 아침이 오늘보다 " + num(Math.abs(dMin)) + "° 추워요. " + say(lines, "coat"));
        else if (dMax <= -5) parts.add("내일 낮이 오늘보다 " + num(Math.abs(dMax)) + "° 낮아요. " + say(lines, "coat"));
        if (dMax >= 5) parts.add("내일은 오늘보다 " + num(dMax) + "° 더워요. " + say(lines, "light"));
        if (parts.isEmpty()) return null;
        return new Msg("🌙 내일 출근 준비 (" + place + ")", String.join(" ", parts));
    }

    static String clock(String hhmm) {
        return hhmm.substring(0, 2) + ":" + hhmm.substring(2);
    }

    /** 테스트 알림 (서버 weather-push-test 와 같은 문장, 비 알림은 앱에 없다) */
    public static Msg test(String place, String morning, String night, Map<String, String> lines) {
        String p = place == null || place.isEmpty() ? "우리 동네" : place;
        return new Msg("🔔 테스트 알림", say(lines, "umbrella") + " 알림이 잘 도착해요. " + p + " 기준으로 아침 " + clock(morning)
            + " 브리핑, 밤 " + clock(night) + " 내일 준비 알림을 보내드려요.");
    }
}
