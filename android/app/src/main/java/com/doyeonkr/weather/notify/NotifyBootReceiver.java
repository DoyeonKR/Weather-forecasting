package com.doyeonkr.weather.notify;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 재부팅·앱 업데이트·시간대 변경 뒤에 알람을 다시 건다 (알람은 이때 사라진다) */
public class NotifyBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        NotifyScheduler.sync(context.getApplicationContext());
    }
}
