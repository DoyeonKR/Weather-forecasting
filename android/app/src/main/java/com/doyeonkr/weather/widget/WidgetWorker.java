package com.doyeonkr.weather.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * 위젯 날씨를 받아 온다. 30분마다(시스템이 미룰 수 있다) + 장소가 바뀌거나 위젯을 놓을 때 한 번.
 * Open-Meteo 두 서버를 차례로 시도한다 — api.open-meteo.com 만 통째로 멈춘 일이 있었다(2026-11-14, 웹앱 lib/weather.ts 와 같은 이유).
 */
public class WidgetWorker extends Worker {
    private static final String PERIODIC = "weather-widget-periodic";
    private static final String ONCE = "weather-widget-once";
    private static final String[] HOSTS = { "api.open-meteo.com", "historical-forecast-api.open-meteo.com" };

    public WidgetWorker(@NonNull Context c, @NonNull WorkerParameters p) {
        super(c, p);
    }

    private static Constraints net() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** 주기 갱신 등록 (이미 있으면 그대로 둔다) */
    public static void schedule(Context c) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(WidgetWorker.class, 30, TimeUnit.MINUTES)
            .setConstraints(net())
            .build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req);
    }

    /** 지금 한 번 갱신 */
    public static void refreshNow(Context c) {
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(WidgetWorker.class).setConstraints(net()).build();
        WorkManager.getInstance(c).enqueueUniqueWork(ONCE, ExistingWorkPolicy.REPLACE, req);
    }

    public static void cancel(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork(PERIODIC);
        WorkManager.getInstance(c).cancelUniqueWork(ONCE);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (!WidgetStore.hasPlace(c)) {
            WidgetStore.renderAll(c);
            return Result.success();
        }
        String q = String.format(Locale.US,
            "/v1/forecast?latitude=%.4f&longitude=%.4f&timezone=auto&past_days=1&forecast_days=2"
                + "&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,precipitation"
                + "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            WidgetStore.lat(c), WidgetStore.lon(c));
        for (String host : HOSTS) {
            try {
                JSONObject j = new JSONObject(get("https://" + host + q));
                JSONObject cur = j.getJSONObject("current");
                double temp = cur.getDouble("temperature_2m");
                int code = cur.getInt("weather_code");
                boolean day = cur.optInt("is_day", 1) == 1;
                // hourly 는 어제 00시부터 → 인덱스 0~23 이 어제. 지금 시각의 어제 값과 비교한다 (웹앱과 같은 방식)
                int hour = Integer.parseInt(cur.getString("time").substring(11, 13));
                JSONArray hourly = j.getJSONObject("hourly").getJSONArray("temperature_2m");
                double delta = hourly.isNull(hour) ? 0 : temp - hourly.getDouble(hour);
                JSONObject daily = j.getJSONObject("daily");
                // daily 는 [어제, 오늘, 내일] (past_days=1, forecast_days=2) — 오늘은 1 번
                int today = 1;
                double hi = daily.getJSONArray("temperature_2m_max").getDouble(today);
                double lo = daily.getJSONArray("temperature_2m_min").getDouble(today);
                JSONArray pr = daily.getJSONArray("precipitation_probability_max");
                int rain = pr.isNull(today) ? -1 : pr.getInt(today);
                // 다음 비: 지금부터 24시간 안 — hourly 는 어제 0시부터라 지금은 24 + hour 번째 칸
                JSONArray hp = j.getJSONObject("hourly").getJSONArray("precipitation");
                double[] precip = new double[hp.length()];
                for (int k = 0; k < precip.length; k++) precip[k] = hp.isNull(k) ? 0 : hp.getDouble(k);
                int after = WidgetRain.hoursUntil(precip, 24 + hour);
                long hourStart = System.currentTimeMillis() / 3_600_000L * 3_600_000L; // 지금 시각의 정각 (분·초 버림)
                long rainAt = after < 0 ? 0 : hourStart + after * 3_600_000L;
                WidgetStore.saveWeather(c, temp, code, day, hi, lo, rain, delta, rainAt);
                WidgetStore.renderAll(c);
                return Result.success();
            } catch (Exception ignored) {
                // 다음 서버로
            }
        }
        WidgetStore.renderAll(c); // 받던 값(기준 시각 표시)을 그대로 둔다
        return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
    }

    /** 연결 8초 · 읽기 8초 — 응답이 멈춰도 일이 끝나게 */
    private static String get(String url) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(8_000);
        h.setReadTimeout(8_000);
        try {
            if (h.getResponseCode() != 200) throw new Exception("http " + h.getResponseCode());
            try (InputStream in = h.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } finally {
            h.disconnect();
        }
    }
}
