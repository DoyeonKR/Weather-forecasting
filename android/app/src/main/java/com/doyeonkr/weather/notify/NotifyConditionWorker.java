package com.doyeonkr.weather.notify;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.Calendar;
import java.util.Map;
import java.util.TimeZone;

/**
 * 조건 알림 — 한 시간쯤마다(서버 크론처럼) 07~21시에만.
 *  비 시작은 6시간에 한 번, 미세먼지·폭염/한파는 하루 한 번 (보낸 날만 기록 — 서버와 같다).
 * 절전 중에는 안드로이드가 조금 미룰 수 있다 (아침·밤 브리핑처럼 정확한 알람은 아니다).
 */
public class NotifyConditionWorker extends Worker {
    static final int ID_RAIN = 104, ID_AIR = 105, ID_TEMP = 106;
    private static final long RAIN_GAP_MS = 6 * 3600_000L;

    public NotifyConditionWorker(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    @NonNull
    @Override
    public Result doWork() {
        run(getApplicationContext(), System.currentTimeMillis());
        return Result.success();
    }

    /** 테스트(디버그 화면)에서도 부른다 */
    public static void run(Context c, long now) {
        if (!NotifyStore.enabled(c) || !NotifyStore.anyAlert(c) || !Notifier.allowed(c)) return;
        TimeZone tz = TimeZone.getDefault();
        Calendar cal = Calendar.getInstance(tz);
        cal.setTimeInMillis(now);
        if (!Conditions.awakeHour(cal.get(Calendar.HOUR_OF_DAY))) return;
        String today = Slot.day(now, tz);
        String place = NotifyStore.placeName(c);
        double lat = NotifyStore.lat(c), lon = NotifyStore.lon(c);
        Map<String, String> lines = Lines.load(c, NotifyStore.persona(c));

        if (NotifyStore.alert(c, "rain") && now - NotifyStore.lastRainAlert(c) >= RAIN_GAP_MS) {
            Forecast.Minutely m = Forecast.minutely(c, lat, lon, 8_000);
            Conditions.Soon soon = m == null ? null : Conditions.rainSoon(m.times, m.precip, m.snowfall, now / 1000);
            if (soon != null) {
                Calendar at = Calendar.getInstance(tz);
                at.setTimeInMillis(soon.startSec * 1000);
                if (Notifier.post(c, ID_RAIN, Conditions.rainMsg(place, at.get(Calendar.HOUR_OF_DAY), soon.snow, lines))) {
                    NotifyStore.markRainAlert(c, now);
                }
            }
        }
        if (NotifyStore.alert(c, "air") && !today.equals(NotifyStore.lastSent(c, "air"))) {
            Integer g = Forecast.airNow(c, lat, lon, 8_000);
            Brief.Msg msg = g == null ? null : Conditions.airMsg(place, g, lines);
            if (msg != null && Notifier.post(c, ID_AIR, msg)) NotifyStore.markSent(c, "air", today);
        }
        if (NotifyStore.alert(c, "temp") && !today.equals(NotifyStore.lastSent(c, "temp"))) {
            Forecast.Days d = NotifyRunner.days(c);
            Brief.Msg msg = d == null ? null : Conditions.tempMsg(place, d.today, lines);
            if (msg != null && Notifier.post(c, ID_TEMP, msg)) NotifyStore.markSent(c, "temp", today);
        }
    }
}
