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
    }

    public static void enable(Context c) {
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
