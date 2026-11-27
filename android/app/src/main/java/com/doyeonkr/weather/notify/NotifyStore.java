package com.doyeonkr.weather.notify;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * 앱 알림 설정·기록 (웹이 아니라 앱이 정본 — 앱을 열지 않아도 알람이 읽는다).
 * 지역은 웹의 "알림 기준 지역"(lib/notifyPlace = 기본 지역)을 AppNotify.update 로 받는다. 위젯 지역(보고 있는 곳)과 다르다.
 */
public final class NotifyStore {
    private static final String PREFS = "weather_notify";

    private NotifyStore() {}

    static SharedPreferences p(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static boolean enabled(Context c) { return p(c).getBoolean("enabled", false); }
    static void setEnabled(Context c, boolean on) { p(c).edit().putBoolean("enabled", on).apply(); }

    public static boolean hasPlace(Context c) { return p(c).contains("lat"); }
    static double lat(Context c) { return Double.parseDouble(p(c).getString("lat", "37.5665")); }
    static double lon(Context c) { return Double.parseDouble(p(c).getString("lon", "126.978")); }
    static String label(Context c) { return p(c).getString("label", "서울 (기본 위치)"); }
    /** 알림에 쓸 동네 이름 — "서울 (기본 위치)" 는 "서울" 로 (웹 notifyPlaceName 과 같게) */
    static String placeName(Context c) { return label(c).replace(" (기본 위치)", ""); }
    static String persona(Context c) { return p(c).getString("persona", "default"); }
    static String morning(Context c) { return p(c).getString("morning", "0730"); }
    static String night(Context c) { return p(c).getString("night", "2130"); }

    static void savePlace(Context c, double lat, double lon, String label) {
        p(c).edit().putString("lat", String.valueOf(lat)).putString("lon", String.valueOf(lon)).putString("label", label).apply();
    }

    static void savePersona(Context c, String persona) { p(c).edit().putString("persona", persona).apply(); }

    static void saveTimes(Context c, String morning, String night) {
        SharedPreferences.Editor e = p(c).edit();
        if (Slot.valid(morning)) e.putString("morning", morning);
        if (Slot.valid(night)) e.putString("night", night);
        e.apply();
    }

    /** 조건 알림 (비 시작·미세먼지·폭염/한파) — 웹처럼 처음 켤 때 모두 켠 채로 시작 */
    static boolean alert(Context c, String kind) { return p(c).getBoolean("a_" + kind, false); }
    static boolean anyAlert(Context c) { return alert(c, "rain") || alert(c, "air") || alert(c, "temp"); }
    static boolean alertsChosen(Context c) { return p(c).getBoolean("a_set", false); }
    static void setAlert(Context c, String kind, boolean on) { p(c).edit().putBoolean("a_" + kind, on).putBoolean("a_set", true).apply(); }

    /** 마지막 비 시작 알림 시각(ms) — 6시간에 한 번 */
    static long lastRainAlert(Context c) { return p(c).getLong("last_rain", 0); }
    static void markRainAlert(Context c, long at) { p(c).edit().putLong("last_rain", at).apply(); }

    /** 오늘 이 알림(morning/night/air/temp)을 보냈나 */
    static String lastSent(Context c, String mode) { return p(c).getString("sent_" + mode, ""); }
    static void markSent(Context c, String mode, String day) { p(c).edit().putString("sent_" + mode, day).apply(); }

    /** 마지막으로 받은 예보 원문 — 알람이 울렸는데 인터넷이 막혔을 때(절전 중) 이걸로 쓴다 */
    static void saveForecast(Context c, String json, double lat, double lon) {
        p(c).edit().putString("fc_json", json).putString("fc_lat", String.valueOf(lat)).putString("fc_lon", String.valueOf(lon))
            .putLong("fc_at", System.currentTimeMillis()).apply();
    }

    /** 같은 동네(약 1km 안)·36시간 안에 받은 예보만 */
    static String cachedForecast(Context c, double lat, double lon) {
        SharedPreferences s = p(c);
        String j = s.getString("fc_json", null);
        if (j == null) return null;
        try {
            double clat = Double.parseDouble(s.getString("fc_lat", "0")), clon = Double.parseDouble(s.getString("fc_lon", "0"));
            if (Math.abs(clat - lat) >= 0.01 || Math.abs(clon - lon) >= 0.01) return null;
        } catch (NumberFormatException e) {
            return null;
        }
        return System.currentTimeMillis() - s.getLong("fc_at", 0) < 36 * 3600_000L ? j : null;
    }
}
