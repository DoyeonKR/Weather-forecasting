package com.doyeonkr.weather.notify;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.doyeonkr.weather.MainActivity;
import com.doyeonkr.weather.R;

/** 알림 띄우기 — 채널 하나("날씨 브리핑"), 누르면 앱이 열린다 */
public final class Notifier {
    static final String CHANNEL = "weather_brief";
    static final int ID_MORNING = 101, ID_NIGHT = 102, ID_TEST = 103;

    private Notifier() {}

    static void ensureChannel(Context c) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager m = c.getSystemService(NotificationManager.class);
        if (m == null || m.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "날씨 브리핑", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("아침 오늘 날씨 브리핑 · 밤 내일 출근 준비");
        m.createNotificationChannel(ch);
    }

    /** 알림을 띄울 수 있나 (안드로이드 13+ 권한, 또는 설정에서 이 앱 알림을 껐는지) */
    public static boolean allowed(Context c) {
        return NotificationManagerCompat.from(c).areNotificationsEnabled();
    }

    static boolean post(Context c, int id, Brief.Msg msg) {
        if (msg == null || !allowed(c)) return false;
        ensureChannel(c);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_weather)
            .setContentTitle(msg.title)
            .setContentText(msg.body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(msg.body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(c).notify(id, b.build());
            return true;
        } catch (SecurityException e) {
            return false; // 그사이 권한을 거뒀다
        }
    }
}
