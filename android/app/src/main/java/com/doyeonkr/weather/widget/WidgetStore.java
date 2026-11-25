package com.doyeonkr.weather.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import com.doyeonkr.weather.MainActivity;
import com.doyeonkr.weather.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 위젯이 쓰는 저장소 + 그리기.
 *  · 장소: 앱(웹)이 WidgetBridge.setPlace 로 넣어 준다. 앱을 한 번도 안 열었으면 비어 있다.
 *  · 날씨: WidgetWorker 가 받아 와 숫자만 저장한다. 위젯은 저장된 값만 그린다(그리기에서 네트워크를 쓰지 않는다).
 * 말투: 위젯은 사실만 짧게 — 앱의 말투 설정(페르소나)은 쓰지 않는다.
 */
public final class WidgetStore {
    private static final String PREFS = "weather_widget";

    private WidgetStore() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void savePlace(Context c, double lat, double lon, String label) {
        prefs(c).edit()
            .putString("lat", String.valueOf(lat))
            .putString("lon", String.valueOf(lon))
            .putString("label", label)
            .apply();
    }

    static boolean hasPlace(Context c) {
        return prefs(c).contains("lat");
    }

    static double lat(Context c) { return Double.parseDouble(prefs(c).getString("lat", "0")); }
    static double lon(Context c) { return Double.parseDouble(prefs(c).getString("lon", "0")); }

    public static boolean placeChanged(Context c, double lat, double lon) {
        if (!hasPlace(c)) return true;
        return Math.abs(lat(c) - lat) > 0.005 || Math.abs(lon(c) - lon) > 0.005;
    }

    /** 마지막으로 날씨를 받은 시각(ms). 없으면 0 */
    public static long fetchedAt(Context c) {
        return prefs(c).getLong("at", 0);
    }

    static void saveWeather(Context c, double temp, int code, boolean isDay, double hi, double lo, int rainProb, double delta) {
        prefs(c).edit()
            .putFloat("temp", (float) temp)
            .putInt("code", code)
            .putBoolean("day", isDay)
            .putFloat("hi", (float) hi)
            .putFloat("lo", (float) lo)
            .putInt("rain", rainProb)
            .putFloat("delta", (float) delta)
            .putLong("at", System.currentTimeMillis())
            .apply();
    }

    /** 놓여 있는 위젯을 모두 다시 그린다 */
    public static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WeatherWidget.class));
        if (ids.length == 0) return;
        RemoteViews v = build(c);
        for (int id : ids) m.updateAppWidget(id, v);
    }

    static int count(Context c) {
        return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, WeatherWidget.class)).length;
    }

    static RemoteViews build(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_weather);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_root, pi);

        SharedPreferences p = prefs(c);
        long at = p.getLong("at", 0);
        if (!hasPlace(c) || at == 0) {
            v.setTextViewText(R.id.w_place, "무능한 날씨예측기");
            v.setTextViewText(R.id.w_time, "");
            v.setTextViewText(R.id.w_emoji, "⛅");
            v.setTextViewText(R.id.w_temp, "");
            v.setTextViewText(R.id.w_cond, hasPlace(c) ? "날씨를 받아오고 있어요" : "앱을 한 번 열면");
            v.setTextViewText(R.id.w_hilo, hasPlace(c) ? "" : "여기에 날씨가 나와요");
            v.setTextViewText(R.id.w_compare, "");
            v.setTextViewText(R.id.w_rain, "눌러서 앱 열기");
            return v;
        }

        double temp = p.getFloat("temp", 0);
        int code = p.getInt("code", 0);
        boolean day = p.getBoolean("day", true);
        double delta = p.getFloat("delta", 0);
        v.setTextViewText(R.id.w_place, p.getString("label", ""));
        v.setTextViewText(R.id.w_time, new SimpleDateFormat("a h:mm", Locale.KOREA).format(new Date(at)) + " 기준");
        v.setTextViewText(R.id.w_emoji, emoji(code, day));
        v.setTextViewText(R.id.w_temp, Math.round(temp) + "°");
        v.setTextViewText(R.id.w_cond, label(code));
        v.setTextViewText(R.id.w_hilo, "최고 " + Math.round(p.getFloat("hi", 0)) + "° · 최저 " + Math.round(p.getFloat("lo", 0)) + "°");
        v.setTextViewText(R.id.w_compare, compare(delta));
        int rain = p.getInt("rain", -1);
        v.setTextViewText(R.id.w_rain, rain >= 0 ? "오늘 비 올 확률 " + rain + "%" : "");
        return v;
    }

    /** 앱의 "어제보다" 칸과 같은 규칙 (summary.ts compareTile) */
    static String compare(double delta) {
        double d = Math.round(delta * 10) / 10.0;
        if (Math.abs(d) < 0.5) return "어제 이맘때와 비슷해요";
        return "어제보다 " + Math.round(Math.abs(d)) + "° " + (d > 0 ? "따뜻해요" : "추워요");
    }

    /** 앱의 codeLabel(compare.ts) 과 같은 표 */
    static String label(int code) {
        if (code == 0) return "맑음";
        if (code == 1) return "대체로 맑음";
        if (code == 2) return "구름 조금";
        if (code == 3) return "흐림";
        if (code == 45 || code == 48) return "안개";
        if (code >= 51 && code <= 57) return "약한 비";
        if (code >= 61 && code <= 67) return "비";
        if (code >= 71 && code <= 77) return "눈";
        if (code >= 80 && code <= 82) return "소나기";
        if (code == 85 || code == 86) return "소낙눈";
        if (code >= 95) return "뇌우";
        return "날씨";
    }

    static String emoji(int code, boolean day) {
        if (code == 0) return day ? "☀️" : "🌙";
        if (code == 1) return day ? "🌤️" : "🌙";
        if (code == 2) return "⛅";
        if (code == 3) return "☁️";
        if (code == 45 || code == 48) return "🌫️";
        if (code >= 51 && code <= 57) return "🌦️";
        if (code >= 61 && code <= 67) return "🌧️";
        if (code >= 71 && code <= 77) return "🌨️";
        if (code >= 80 && code <= 82) return "🌧️";
        if (code == 85 || code == 86) return "🌨️";
        if (code >= 95) return "⛈️";
        return "🌡️";
    }
}
