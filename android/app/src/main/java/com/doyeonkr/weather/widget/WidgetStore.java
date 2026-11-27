package com.doyeonkr.weather.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.ArrayMap;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.doyeonkr.weather.MainActivity;
import com.doyeonkr.weather.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

/**
 * 위젯이 쓰는 저장소 + 그리기.
 *  · 장소: 앱(웹)이 WidgetBridge.setPlace 로 넣어 준다. 앱을 한 번도 안 열었으면 비어 있다.
 *  · 날씨: WidgetWorker 가 받아 와 숫자만 저장한다. 위젯은 저장된 값만 그린다(그리기에서 네트워크를 쓰지 않는다).
 *  · 판: 위젯 크기에 따라 좁은 판(widget_weather_compact)·넓은 판(widget_weather_wide)을 고른다.
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

    static void saveWeather(Context c, double temp, int code, boolean isDay, double hi, double lo, int rainProb, double delta, long rainAt) {
        prefs(c).edit()
            .putFloat("temp", (float) temp)
            .putInt("code", code)
            .putBoolean("day", isDay)
            .putFloat("hi", (float) hi)
            .putFloat("lo", (float) lo)
            .putInt("rain", rainProb)
            .putLong("rain_at", rainAt)
            .putFloat("delta", (float) delta)
            .putLong("at", System.currentTimeMillis())
            .apply();
    }

    /** 위젯 한 장에 그릴 값. 저장소에서 읽거나(fromPrefs), 미리보기 화면이 직접 만든다 */
    public static final class Snapshot {
        public boolean ready;      // 날씨를 받아 둔 게 있나
        public boolean hasPlace;   // 앱에서 동네를 넘겨받았나
        public String place = "";
        public long at;
        public double temp, hi, lo, delta;
        public int code, rain = -1;
        /** 다음 비 시작 시각(ms, 정각), 없으면 0 (WidgetRain) */
        public long rainAt;
        public boolean day = true;
    }

    static Snapshot fromPrefs(Context c) {
        SharedPreferences p = prefs(c);
        Snapshot s = new Snapshot();
        s.hasPlace = hasPlace(c);
        s.at = p.getLong("at", 0);
        s.ready = s.hasPlace && s.at != 0;
        s.place = p.getString("label", "");
        s.temp = p.getFloat("temp", 0);
        s.code = p.getInt("code", 0);
        s.day = p.getBoolean("day", true);
        s.hi = p.getFloat("hi", 0);
        s.lo = p.getFloat("lo", 0);
        s.rain = p.getInt("rain", -1);
        s.rainAt = p.getLong("rain_at", 0);
        s.delta = p.getFloat("delta", 0);
        return s;
    }

    // 판 고르기 기준(dp). 3칸 위젯이 폭 360dp 폰(갤럭시 일부)에서 약 230dp 라 그보다 조금 낮게.
    // 이 폭에서 "-12°" 옆에 "대체로 맑음"이 들어가도록 긴 기온은 글씨를 줄인다 (LONG_TEMP_DP)
    static final int WIDE_MIN_W = 220;
    static final int WIDE_TEMP_DP = 54, LONG_TEMP_DP = 44;

    /**
     * 높이 기준(dp) — 이보다 낮으면 글줄을 아래에서부터 숨긴다. 글자 크기 설정(크게)에 맞춰 올린다:
     * 기온 숫자는 dp 라 그대로지만 나머지 글줄은 sp 라 같이 커진다 (1.3배에서 작은 판 아래 줄이 잘렸다).
     */
    static int heightFor(Context c, int base, int textDp) {
        float fs = c.getResources().getConfiguration().fontScale;
        return Math.round(base + textDp * Math.max(0f, fs - 1f));
    }
    static int compactMinH(Context c) { return heightFor(c, 118, 50); }  // 이보다 낮으면 날씨 글도 숨긴다 (아이콘이 대신한다)
    static int compactMidH(Context c) { return heightFor(c, 125, 75); }  // 이보다 낮으면 최고/최저 줄을 숨긴다
    static int compactFullH(Context c) { return heightFor(c, 150, 95); } // 이보다 낮으면 "어제보다" 줄을 숨긴다
    static int compactMetaH(Context c) { return heightFor(c, 168, 110); } // 이보다 낮으면 좁은 판 맨 아래 비 확률·시각 줄을 숨긴다
    static int wideFullH(Context c) { return heightFor(c, 135, 95); }    // 이보다 낮으면 넓은 판 아래 줄·최고/최저 줄을 숨긴다

    /** 놓여 있는 위젯을 모두 다시 그린다 */
    public static void renderAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WeatherWidget.class));
        if (ids.length == 0) return;
        Snapshot s = fromPrefs(c);
        for (int id : ids) render(c, m, id, s);
    }

    /** 위젯 한 장 — 크기에 맞는 판으로 그린다 */
    static void render(Context c, AppWidgetManager m, int id, Snapshot s) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // 안드로이드 12+: 크기별 판을 모두 넘기면, 크기를 바꿀 때마다 런처가 맞는 판을 고른다 (들어가는 것 중 가장 큰 판)
            Map<SizeF, RemoteViews> map = new ArrayMap<>();
            int[] heights = { 0, compactMinH(c), compactMidH(c), compactFullH(c), compactMetaH(c) };
            for (int h : heights) map.put(new SizeF(0, h), build(c, s, 0, h));
            int[] wideHeights = { 0, wideFullH(c) };
            for (int h : wideHeights) map.put(new SizeF(WIDE_MIN_W, h), build(c, s, WIDE_MIN_W, h));
            m.updateAppWidget(id, new RemoteViews(map));
            return;
        }
        // 그 아래: 세로 화면 기준 크기(가로는 MIN_WIDTH, 세로는 MAX_HEIGHT)로 한 판을 고른다
        Bundle o = m.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
        if (w == 0) w = WIDE_MIN_W; // 크기를 아직 모르면 기본 3×2 (넓은 판)
        if (h == 0) h = compactFullH(c);
        m.updateAppWidget(id, build(c, s, w, h));
    }

    /** 크기(dp)에 맞는 판에 값을 채운다 */
    public static RemoteViews build(Context c, Snapshot s, int widthDp, int heightDp) {
        boolean wide = widthDp >= WIDE_MIN_W;
        RemoteViews v = new RemoteViews(c.getPackageName(),
            wide ? R.layout.widget_weather_wide : R.layout.widget_weather_compact);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(android.R.id.background, pi);

        boolean showBottom = heightDp >= (wide ? wideFullH(c) : compactFullH(c));
        boolean showHilo = heightDp >= (wide ? wideFullH(c) : compactMidH(c));
        boolean showCond = wide || heightDp >= compactMinH(c);
        v.setViewVisibility(R.id.w_bottom, showBottom ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_hilo, showHilo ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_cond, showCond ? View.VISIBLE : View.GONE);
        if (!wide) v.setViewVisibility(R.id.w_meta, s.ready && heightDp >= compactMetaH(c) ? View.VISIBLE : View.GONE);

        if (!s.ready) {
            v.setInt(android.R.id.background, "setBackgroundResource", R.drawable.widget_bg_clear_day);
            v.setTextViewText(R.id.w_place, "무능한 날씨예측기");
            v.setViewVisibility(R.id.w_pin, View.GONE);
            v.setTextViewText(R.id.w_time, "");
            v.setImageViewResource(R.id.w_icon, R.drawable.ic_w_partly_day);
            v.setTextViewText(R.id.w_temp, ""); // 숫자 자리는 비워 두고 아이콘·안내 글만
            v.setTextViewText(R.id.w_cond, s.hasPlace ? "날씨 받는 중" : "앱을 한 번 열면");
            v.setTextViewText(R.id.w_hilo, s.hasPlace ? "잠시만 기다려 주세요" : "여기에 날씨가 나와요");
            v.setTextViewText(R.id.w_compare, "눌러서 앱 열기");
            v.setTextColor(R.id.w_compare, 0xE6FFFFFF);
            v.setViewVisibility(R.id.w_drop, View.GONE);
            v.setViewVisibility(R.id.w_rain, View.GONE);
            return v;
        }

        v.setInt(android.R.id.background, "setBackgroundResource", background(s.code, s.day));
        v.setViewVisibility(R.id.w_pin, View.VISIBLE);
        v.setTextViewText(R.id.w_place, s.place.isEmpty() ? "우리 동네" : s.place);
        v.setTextViewText(R.id.w_time, new SimpleDateFormat("a h:mm", Locale.KOREA).format(new Date(s.at)));
        v.setImageViewResource(R.id.w_icon, icon(s.code, s.day));
        String t = Math.round(s.temp) + "°";
        v.setTextViewText(R.id.w_temp, t);
        if (wide) v.setTextViewTextSize(R.id.w_temp, TypedValue.COMPLEX_UNIT_DIP, t.length() >= 4 ? LONG_TEMP_DP : WIDE_TEMP_DP);
        v.setTextViewText(R.id.w_cond, label(s.code));
        v.setTextViewText(R.id.w_hilo, "최고 " + Math.round(s.hi) + "° · 최저 " + Math.round(s.lo) + "°");
        v.setTextViewText(R.id.w_compare, compare(s.delta));
        v.setTextColor(R.id.w_compare, compareColor(s.delta));
        // 24시간 안에 비가 오면 "15시 비"·"내일 6시 비"·"지금 비", 아니면 오늘 비 올 확률
        String next = WidgetRain.label(s.rainAt, System.currentTimeMillis(), java.util.TimeZone.getDefault());
        boolean hasRain = next != null || s.rain >= 0;
        v.setViewVisibility(R.id.w_drop, hasRain ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_rain, hasRain ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.w_rain, next != null ? next : hasRain ? s.rain + "%" : "");
        return v;
    }

    /** "어제보다" 줄 색 — 따뜻하면 노을빛, 추우면 얼음빛, 비슷하면 흰색 */
    static int compareColor(double delta) {
        double d = Math.round(delta * 10) / 10.0;
        if (Math.abs(d) < 0.5) return 0xE6FFFFFF;
        return d > 0 ? 0xFFFFD27A : 0xFFA8D8FF;
    }

    /** 날씨·낮밤에 따라 배경 그라데이션 */
    static int background(int code, boolean day) {
        if (code >= 95) return R.drawable.widget_bg_storm;
        boolean wet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
        boolean snow = (code >= 71 && code <= 77) || code == 85 || code == 86;
        if (!day) return code <= 1 ? R.drawable.widget_bg_night : R.drawable.widget_bg_night_cloudy;
        if (wet) return R.drawable.widget_bg_rain;
        if (snow) return R.drawable.widget_bg_snow;
        if (code <= 1) return R.drawable.widget_bg_clear_day;
        return R.drawable.widget_bg_cloudy_day; // 구름 조금·흐림·안개
    }

    /** 날씨 아이콘 — 이모지는 기기 회사마다 모양이 달라 벡터(ic_w_*)로 그린다 */
    static int icon(int code, boolean day) {
        if (code == 0) return day ? R.drawable.ic_w_sun : R.drawable.ic_w_moon;
        if (code == 1 || code == 2) return day ? R.drawable.ic_w_partly_day : R.drawable.ic_w_partly_night;
        if (code == 3) return R.drawable.ic_w_cloud;
        if (code == 45 || code == 48) return R.drawable.ic_w_fog;
        if (code >= 51 && code <= 67) return R.drawable.ic_w_rain;
        if (code >= 71 && code <= 77) return R.drawable.ic_w_snow;
        if (code >= 80 && code <= 82) return R.drawable.ic_w_rain;
        if (code == 85 || code == 86) return R.drawable.ic_w_snow;
        if (code >= 95) return R.drawable.ic_w_storm;
        return R.drawable.ic_w_cloud;
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
}
