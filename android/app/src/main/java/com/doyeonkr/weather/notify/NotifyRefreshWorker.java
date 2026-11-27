package com.doyeonkr.weather.notify;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** 3시간마다 알림 지역 예보를 미리 받아 둔다 + 알람이 살아 있게 다시 건다 */
public class NotifyRefreshWorker extends Worker {
    public NotifyRefreshWorker(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (!NotifyStore.enabled(c)) return Result.success();
        NotifyRunner.days(c); // 받으면서 저장한다
        NotifyScheduler.schedule(c, "morning");
        NotifyScheduler.schedule(c, "night");
        return Result.success();
    }
}
