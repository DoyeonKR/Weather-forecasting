package com.doyeonkr.weather.notify;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 아침·밤 알람 → 예보를 받아 알림 → 다음 날 알람을 다시 건다 */
public class NotifyAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!NotifyScheduler.ACTION.equals(intent.getAction())) return;
        String mode = "night".equals(intent.getStringExtra(NotifyScheduler.EXTRA_MODE)) ? "night" : "morning";
        Context c = context.getApplicationContext();
        PendingResult pr = goAsync(); // 예보 받기(최대 8+5초)를 기다린다
        new Thread(() -> {
            NotifyRunner.Outcome out = NotifyRunner.Outcome.DONE;
            try {
                out = NotifyRunner.runSlot(c, mode);
            } catch (Exception ignored) {
                // 한 번 실패해도 다음 날 알람은 건다
            } finally {
                if (out == NotifyRunner.Outcome.RETRY) NotifyScheduler.retryLater(c, mode); // 시각 창(2시간)이 지나면 다음 날로
                else NotifyScheduler.schedule(c, mode);
                pr.finish();
            }
        }).start();
    }
}
