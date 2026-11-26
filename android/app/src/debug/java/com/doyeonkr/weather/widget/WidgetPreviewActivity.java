package com.doyeonkr.weather.widget;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.doyeonkr.weather.widget.WidgetStore.Snapshot;

/**
 * 디버그 전용 위젯 미리보기 — 진짜 위젯과 같은 RemoteViews 를 정해진 크기(dp) 칸에 그린다.
 * 날씨 값을 일부러 나쁜 경우(-12°, 긴 동네 이름, 빈 화면)로 넣어 글이 잘리는지 본다.
 *   adb shell am start -n com.doyeonkr.weather/.widget.WidgetPreviewActivity --es page a|b|c
 * 진짜 홈 화면에서 크기별 판 바뀜을 볼 때: --es seed winter|today (저장소에 가짜 날씨) · --ez pin true (위젯 추가 창)
 */
public class WidgetPreviewActivity extends Activity {
    private LinearLayout col;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        String seed = getIntent().getStringExtra("seed");
        if (seed != null) {
            boolean w = seed.equals("winter");
            WidgetStore.savePlace(this, 37.27, 127.0, w ? "서울특별시 강남구 역삼동" : "수원시 매산로1가");
            WidgetStore.saveWeather(this, w ? -12 : 6, w ? 3 : 1, true, w ? -8 : 14, w ? -15 : 3, w ? 80 : 0, w ? -6.3 : 9);
            WidgetStore.renderAll(this);
        }
        if (getIntent().getBooleanExtra("pin", false) && android.os.Build.VERSION.SDK_INT >= 26) {
            android.appwidget.AppWidgetManager m = getSystemService(android.appwidget.AppWidgetManager.class);
            m.requestPinAppWidget(new android.content.ComponentName(this, WeatherWidget.class), null, null);
        }
        String page = getIntent().getStringExtra("page");
        if (page == null) page = "a";
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.rgb(40, 40, 44));
        col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(4), dp(28), dp(4), dp(8));
        sv.addView(col);
        setContentView(sv);

        Snapshot today = snap("수원시 매산로1가", 6, 1, true, 14, 3, 9, 0);
        Snapshot winter = snap("서울특별시 강남구 역삼동", -12, 3, true, -8, -15, -6.3, 80);
        switch (page) {
            case "a":
                row("오늘 값 · 160×185 / 240×185", today, 160, 185, today, 240, 185);
                row("한겨울 최악 · 160×185 / 240×185", winter, 160, 185, winter, 240, 185);
                row("작은 크기 · 145×145 / 110×110 / 135×120", today, 145, 145, today, 110, 110, today, 135, 120);
                row("갤럭시 360dp 폭의 3칸 근처 · 220×185 / 175×185", snap("서울특별시 강남구 역삼동", -12, 1, true, -8, -15, -6.3, 80), 220, 185, today, 175, 185);
                row("넓게 · 330×185", winter, 330, 185);
                row("낮고 넓게 · 250×120", winter, 250, 120);
                break;
            case "b":
                row("맑은 밤", snap("수원시 매산로1가", 2, 0, false, 9, 1, 0.2, 10), 160, 185, snap("수원시 매산로1가", 2, 0, false, 9, 1, 0.2, 10), 240, 185);
                row("비", snap("부산광역시 해운대구", 11, 63, true, 13, 9, -3, 90), 160, 185, snap("부산광역시 해운대구", 11, 63, true, 13, 9, -3, 90), 240, 185);
                row("눈", snap("강원도 평창군", -3, 73, true, -1, -9, -2, 70), 160, 185, snap("강원도 평창군", -3, 73, true, -1, -9, -2, 70), 240, 185);
                row("뇌우", snap("수원시 매산로1가", 24, 95, true, 28, 21, 1.4, 60), 160, 185, snap("수원시 매산로1가", 24, 95, true, 28, 21, 1.4, 60), 240, 185);
                break;
            default:
                Snapshot none = new Snapshot();
                Snapshot loading = new Snapshot();
                loading.hasPlace = true;
                Snapshot fog = snap("인천광역시 연수구 송도동", 8, 45, true, 12, 5, -0.6, -1);
                row("앱을 아직 안 열었을 때", none, 160, 185, none, 240, 185);
                row("받아오는 중", loading, 160, 185, loading, 240, 185);
                row("안개 · 비 확률 없음 · 흐린 밤", fog, 160, 185, snap("수원시", 4, 3, false, 7, 2, -1.2, 30), 240, 185);
        }
    }

    private static Snapshot snap(String place, double temp, int code, boolean day, double hi, double lo, double delta, int rain) {
        Snapshot s = new Snapshot();
        s.ready = true;
        s.hasPlace = true;
        s.place = place;
        s.at = System.currentTimeMillis();
        s.temp = temp;
        s.code = code;
        s.day = day;
        s.hi = hi;
        s.lo = lo;
        s.delta = delta;
        s.rain = rain;
        return s;
    }

    /** 이름표 한 줄 + (값, 가로, 세로) 묶음들 */
    private void row(String title, Object... items) {
        TextView t = new TextView(this);
        t.setText(title);
        t.setTextColor(Color.LTGRAY);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        t.setPadding(dp(4), dp(6), 0, dp(2));
        col.addView(t);
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.HORIZONTAL);
        col.addView(r);
        for (int i = 0; i < items.length; i += 3) {
            Snapshot s = (Snapshot) items[i];
            int w = (Integer) items[i + 1], h = (Integer) items[i + 2];
            FrameLayout f = new FrameLayout(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(w), dp(h));
            lp.setMargins(dp(4), 0, dp(4), 0);
            r.addView(f, lp);
            f.addView(WidgetStore.build(this, s, w, h).apply(this, f),
                new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
