package com.doyeonkr.weather.notify;

import android.content.Context;

import java.util.Map;
import java.util.TimeZone;

/** 알람이 울렸을 때·테스트 버튼을 눌렀을 때 실제로 예보를 받아 알림을 만든다 */
public final class NotifyRunner {
    private NotifyRunner() {}

    /** 예보: 지금 받아 보고(8초), 안 되면 받아 둔 것 */
    static Forecast.Days days(Context c) {
        double lat = NotifyStore.lat(c), lon = NotifyStore.lon(c);
        String body = Forecast.fetch(c, lat, lon, 8_000);
        if (body != null && Forecast.parse(body, System.currentTimeMillis()) != null) NotifyStore.saveForecast(c, body, lat, lon);
        else body = NotifyStore.cachedForecast(c, lat, lon);
        return body == null ? null : Forecast.parse(body, System.currentTimeMillis());
    }

    /** 알람 한 번의 결과 — RETRY 는 예보를 못 구해 15분 뒤 다시 (시각 창 안일 때만) */
    enum Outcome { DONE, RETRY }

    /** 알람 한 번 — 켜져 있고, 오늘 아직 안 보냈고, 늦지 않았을 때만 */
    static Outcome runSlot(Context c, String mode) {
        if (!NotifyStore.enabled(c)) return Outcome.DONE;
        long now = System.currentTimeMillis();
        TimeZone tz = TimeZone.getDefault();
        String today = Slot.day(now, tz);
        if (today.equals(NotifyStore.lastSent(c, mode))) return Outcome.DONE;
        String hhmm = "morning".equals(mode) ? NotifyStore.morning(c) : NotifyStore.night(c);
        if (!Slot.due(hhmm, now, tz)) return Outcome.DONE;
        Forecast.Days d = days(c);
        if (d == null) return Outcome.RETRY; // 예보를 못 구하면 틀린 브리핑 대신 조금 뒤 다시
        Map<String, String> lines = Lines.load(c, NotifyStore.persona(c));
        String place = NotifyStore.placeName(c);
        if ("morning".equals(mode)) {
            Integer air = Forecast.airWorst(c, NotifyStore.lat(c), NotifyStore.lon(c), 5_000);
            Notifier.post(c, Notifier.ID_MORNING, Brief.morning(place, d.yesterday, d.today, air, lines));
        } else {
            Notifier.post(c, Notifier.ID_NIGHT, Brief.night(place, d.today, d.tomorrow, lines)); // 특이사항 없으면 null → 조용히
        }
        NotifyStore.markSent(c, mode, today);
        return Outcome.DONE;
    }

    /** 테스트 알림 — 서버 테스트와 같은 문장 + 지금 받은 오늘 브리핑 (예보를 못 받으면 문장만) */
    static boolean runTest(Context c) {
        Map<String, String> lines = Lines.load(c, NotifyStore.persona(c));
        String place = NotifyStore.placeName(c);
        Brief.Msg t = Brief.test(place, NotifyStore.morning(c), NotifyStore.night(c), lines);
        Forecast.Days d = days(c);
        String body = t.body;
        if (d != null) body += "\n\n" + Brief.morning(place, d.yesterday, d.today, null, lines).body;
        return Notifier.post(c, Notifier.ID_TEST, new Brief.Msg(t.title, body));
    }
}
