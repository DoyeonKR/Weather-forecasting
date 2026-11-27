package com.doyeonkr.weather.notify;

import android.content.Context;

import com.getcapacitor.JSObject;

/** AppNotify 플러그인이 쓰는 입구 (notify 패키지 안쪽을 감춘다) */
public final class NotifyApi {
    private NotifyApi() {}

    public static JSObject info(Context c) {
        JSObject r = new JSObject();
        r.put("enabled", NotifyStore.enabled(c));
        r.put("allowed", Notifier.allowed(c));
        r.put("morning", NotifyStore.morning(c));
        r.put("night", NotifyStore.night(c));
        r.put("label", NotifyStore.hasPlace(c) ? NotifyStore.label(c) : "");
        r.put("rain", NotifyStore.alert(c, "rain"));
        r.put("air", NotifyStore.alert(c, "air"));
        r.put("temp", NotifyStore.alert(c, "temp"));
        // 배터리 최적화(절전)에서 빠져 있나 — 아니면 제조사 절전이 알림을 늦출 수 있어 안내한다
        android.os.PowerManager pm = c.getSystemService(android.os.PowerManager.class);
        r.put("batteryOptimized", pm != null && !pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        r.put("maker", android.os.Build.MANUFACTURER == null ? "" : android.os.Build.MANUFACTURER.toLowerCase(java.util.Locale.ROOT));
        return r;
    }

    /** 웹이 넘긴 값 저장: lat·lon·label(셋 다 있을 때만), persona, morning, night */
    public static void save(Context c, JSObject d) {
        if (d == null) return;
        if (d.has("lat") && d.has("lon") && d.has("label")) {
            try {
                double lat = d.getDouble("lat"), lon = d.getDouble("lon");
                String label = d.getString("label");
                if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && label != null) {
                    NotifyStore.savePlace(c, lat, lon, label.length() > 60 ? label.substring(0, 60) : label);
                }
            } catch (Exception ignored) {
                // 잘못된 값이면 이전 지역 유지
            }
        }
        String persona = d.getString("persona");
        if (persona != null && persona.matches("default|grandma|bro|community")) NotifyStore.savePersona(c, persona);
        NotifyStore.saveTimes(c, d.getString("morning"), d.getString("night"));
        for (String k : new String[] { "rain", "air", "temp" }) {
            if (d.has(k)) NotifyStore.setAlert(c, k, d.optBoolean(k, false));
        }
    }

    public static void enable(Context c) {
        // 웹처럼 처음 켤 때는 조건 알림까지 모두 켠 채로 (설정에서 하나씩 끌 수 있다)
        if (!NotifyStore.alertsChosen(c)) {
            NotifyStore.setAlert(c, "rain", true);
            NotifyStore.setAlert(c, "air", true);
            NotifyStore.setAlert(c, "temp", true);
        }
        Notifier.ensureChannel(c);
        NotifyStore.setEnabled(c, true);
        NotifyScheduler.sync(c);
    }

    public static void disable(Context c) {
        NotifyStore.setEnabled(c, false);
        NotifyScheduler.sync(c);
    }

    public static void reschedule(Context c) {
        if (NotifyStore.enabled(c)) NotifyScheduler.sync(c);
    }

    public static boolean test(Context c) {
        return NotifyRunner.runTest(c);
    }
}
