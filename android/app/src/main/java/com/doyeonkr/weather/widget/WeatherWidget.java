package com.doyeonkr.weather.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** 홈 화면 날씨 위젯. 그리기는 WidgetStore, 받아오기는 WidgetWorker. */
public class WeatherWidget extends AppWidgetProvider {
    private static final long STALE_MS = 20 * 60 * 1000L;

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        WidgetStore.renderAll(c); // 받아 둔 값부터 바로
        WidgetWorker.schedule(c);
        if (System.currentTimeMillis() - WidgetStore.fetchedAt(c) > STALE_MS) WidgetWorker.refreshNow(c);
    }

    /** 크기를 바꾸면 그 크기에 맞는 판으로 다시 그린다 (안드로이드 11 이하는 여기서만 판이 바뀐다) */
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle newOptions) {
        WidgetStore.render(c, m, id, WidgetStore.fromPrefs(c));
    }

    @Override
    public void onEnabled(Context c) {
        WidgetWorker.schedule(c);
        WidgetWorker.refreshNow(c);
    }

    @Override
    public void onDisabled(Context c) {
        WidgetWorker.cancel(c); // 마지막 위젯을 치우면 갱신도 멈춘다
    }
}
