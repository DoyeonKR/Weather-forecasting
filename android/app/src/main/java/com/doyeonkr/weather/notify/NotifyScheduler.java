package com.doyeonkr.weather.notify;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

/**
 * 아침·밤 알람 걸기. 정확한 알람(setExactAndAllowWhileIdle — 절전 중에도 그 시각에) 권한은
 * 매니페스트의 USE_EXACT_ALARM(13+)·SCHEDULE_EXACT_ALARM(12 이하)로 설치 때 받는다.
 * 그래도 못 쓰는 기기(사용자가 껐을 때)는 "대략" 알람(setAndAllowWhileIdle — 최대 1시간 늦을 수 있다)으로.
 * 예보는 3시간마다 미리 받아 둔다 — 알람이 울릴 때 인터넷이 막혀 있어도 브리핑을 만들 수 있게.
 * 위젯 갱신(WidgetWorker)과 따로 돈다: 위젯을 치워도 알림은 계속.
 */
public final class NotifyScheduler {
    static final String ACTION = "com.doyeonkr.weather.NOTIFY_ALARM";
    static final String EXTRA_MODE = "mode";
    private static final String REFRESH = "weather-notify-refresh";

    private NotifyScheduler() {}

    /** 켜져 있으면 두 알람·예보 미리 받기를 (다시) 건다, 꺼져 있으면 모두 끈다 */
    public static void sync(Context c) {
        if (!NotifyStore.enabled(c)) {
            cancel(c);
            return;
        }
        schedule(c, "morning");
        schedule(c, "night");
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NotifyRefreshWorker.class, 3, TimeUnit.HOURS)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(REFRESH, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    static void schedule(Context c, String mode) {
        String hhmm = "morning".equals(mode) ? NotifyStore.morning(c) : NotifyStore.night(c);
        long now = System.currentTimeMillis();
        TimeZone tz = TimeZone.getDefault();
        boolean sent = Slot.day(now, tz).equals(NotifyStore.lastSent(c, mode));
        setAlarm(c, mode, Slot.next(hhmm, now, sent, tz));
    }

    /** 예보를 못 구했을 때 15분 뒤 다시. 그때 시각 창이 지났으면 다음 날 것으로 */
    static void retryLater(Context c, String mode) {
        String hhmm = "morning".equals(mode) ? NotifyStore.morning(c) : NotifyStore.night(c);
        long at = System.currentTimeMillis() + 15 * 60_000L;
        if (Slot.due(hhmm, at, TimeZone.getDefault())) setAlarm(c, mode, at);
        else schedule(c, mode);
    }

    private static void setAlarm(Context c, String mode, long at) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = pending(c, mode);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static void cancel(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) {
            am.cancel(pending(c, "morning"));
            am.cancel(pending(c, "night"));
        }
        WorkManager.getInstance(c).cancelUniqueWork(REFRESH);
    }

    private static PendingIntent pending(Context c, String mode) {
        Intent i = new Intent(c, NotifyAlarmReceiver.class).setAction(ACTION).putExtra(EXTRA_MODE, mode);
        return PendingIntent.getBroadcast(c, "morning".equals(mode) ? 1 : 2, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
