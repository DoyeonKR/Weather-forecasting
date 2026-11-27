package com.doyeonkr.weather.notify;

import android.content.Context;
import android.content.pm.ApplicationInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.TimeZone;

/**
 * 알림용 예보 받기 — 서버 fetchDaily·fetchAirWorst 와 같은 항목. Open-Meteo 두 서버를 차례로(서버·위젯과 같은 이유).
 * 예보는 어제~모레(past_days=1, forecast_days=3)를 받아, 저녁에 받아 둔 예보로도 다음 날 아침 브리핑을 만들 수 있게 한다.
 */
final class Forecast {
    private Forecast() {}

    private static final String[] HOSTS = { "api.open-meteo.com", "historical-forecast-api.open-meteo.com" };

    /** 어제·오늘·내일 (오늘 = 예보 지역 시간대의 오늘) */
    static final class Days {
        final Brief.Day yesterday, today, tomorrow;

        Days(Brief.Day y, Brief.Day t, Brief.Day tm) {
            yesterday = y;
            today = t;
            tomorrow = tm;
        }
    }

    /** 예보 원문 받기. 실패하면 null */
    static String fetch(Context c, double lat, double lon, int timeoutMs) {
        String q = String.format(Locale.US,
            "/v1/forecast?latitude=%.4f&longitude=%.4f&timezone=auto&past_days=1&forecast_days=3"
                + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,uv_index_max",
            lat, lon);
        String debug = debugBase(c);
        if (debug != null) return get(debug + "/forecast.json", timeoutMs);
        for (String h : HOSTS) {
            String body = get("https://" + h + q, timeoutMs);
            if (body != null && body.contains("\"daily\"")) return body;
        }
        return null;
    }

    /** 원문 → 어제·오늘·내일. now 가 속한 날을 예보 시간대(utc_offset_seconds)로 찾는다. 모자라면 null */
    static Days parse(String json, long now) {
        try {
            JSONObject j = new JSONObject(json);
            int off = j.optInt("utc_offset_seconds", 9 * 3600);
            String today = Slot.day(now, TimeZone.getTimeZone(String.format(Locale.US, "GMT%+03d:%02d", off / 3600, Math.abs(off % 3600) / 60)));
            JSONObject d = j.getJSONObject("daily");
            JSONArray time = d.getJSONArray("time");
            int i = -1;
            for (int k = 0; k < time.length(); k++) if (today.equals(time.getString(k))) i = k;
            if (i < 1 || i + 1 >= time.length()) return null;
            return new Days(day(d, i - 1), day(d, i), day(d, i + 1));
        } catch (Exception e) {
            return null;
        }
    }

    private static Brief.Day day(JSONObject d, int i) throws Exception {
        return new Brief.Day(
            d.getJSONArray("temperature_2m_max").getDouble(i),
            d.getJSONArray("temperature_2m_min").getDouble(i),
            d.getJSONArray("precipitation_probability_max").isNull(i) ? 0 : d.getJSONArray("precipitation_probability_max").getInt(i),
            d.getJSONArray("weather_code").getInt(i),
            d.getJSONArray("uv_index_max").isNull(i) ? 0 : d.getJSONArray("uv_index_max").getDouble(i));
    }

    /** 15분 강수 예보 (웹 lib/rainSoon.ts 와 같은 요청 + 눈 여부). 실패하면 null */
    static final class Minutely {
        final long[] times;
        final double[] precip, snowfall;

        Minutely(long[] t, double[] p, double[] s) {
            times = t;
            precip = p;
            snowfall = s;
        }
    }

    static Minutely minutely(Context c, double lat, double lon, int timeoutMs) {
        String q = String.format(Locale.US,
            "/v1/forecast?latitude=%.4f&longitude=%.4f&minutely_15=precipitation,snowfall&past_minutely_15=2&forecast_minutely_15=8&timeformat=unixtime&timezone=auto",
            lat, lon);
        String debug = debugBase(c);
        String body = null;
        if (debug != null) body = get(debug + "/minutely.json", timeoutMs);
        else for (String h : HOSTS) {
            body = get("https://" + h + q, timeoutMs);
            if (body != null && body.contains("minutely_15")) break;
        }
        if (body == null) return null;
        try {
            JSONObject m = new JSONObject(body).getJSONObject("minutely_15");
            JSONArray t = m.getJSONArray("time"), p = m.getJSONArray("precipitation");
            JSONArray sn = m.optJSONArray("snowfall");
            int n = Math.min(t.length(), p.length());
            long[] times = new long[n];
            double[] precip = new double[n], snow = new double[n];
            for (int i = 0; i < n; i++) {
                times[i] = t.getLong(i);
                precip[i] = p.isNull(i) ? 0 : p.getDouble(i);
                snow[i] = sn == null || i >= sn.length() || sn.isNull(i) ? 0 : sn.getDouble(i);
            }
            return new Minutely(times, precip, snow);
        } catch (Exception e) {
            return null;
        }
    }

    /** 지금 시각 미세먼지 등급 0~3 (서버 fetchAirNow). 실패하면 null */
    static Integer airNow(Context c, double lat, double lon, int timeoutMs) {
        try {
            String debug = debugBase(c);
            String url = debug != null ? debug + "/air.json" : String.format(Locale.US,
                "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=%.4f&longitude=%.4f&timezone=auto&forecast_days=1&hourly=pm10,pm2_5",
                lat, lon);
            String body = get(url, timeoutMs);
            if (body == null) return null;
            JSONObject j = new JSONObject(body);
            int off = j.optInt("utc_offset_seconds", 9 * 3600);
            java.util.Calendar cal = java.util.Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            cal.setTimeInMillis(System.currentTimeMillis() + off * 1000L);
            int i = cal.get(java.util.Calendar.HOUR_OF_DAY);
            JSONObject h = j.getJSONObject("hourly");
            JSONArray pm10 = h.getJSONArray("pm10"), pm25 = h.getJSONArray("pm2_5");
            if (i >= pm10.length() || i >= pm25.length() || pm10.isNull(i) || pm25.isNull(i)) return null;
            return Conditions.airGrade(pm10.getDouble(i), pm25.getDouble(i));
        } catch (Exception e) {
            return null;
        }
    }

    /** 오늘 낮(9~21시) 미세먼지 최악 등급 0~3 (서버 fetchAirWorst). 실패하면 null */
    static Integer airWorst(Context c, double lat, double lon, int timeoutMs) {
        try {
            String debug = debugBase(c);
            String url = debug != null ? debug + "/air.json" : String.format(Locale.US,
                "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=%.4f&longitude=%.4f&timezone=auto&forecast_days=1&hourly=pm10,pm2_5",
                lat, lon);
            String body = get(url, timeoutMs);
            if (body == null) return null;
            JSONObject h = new JSONObject(body).getJSONObject("hourly");
            JSONArray pm10 = h.getJSONArray("pm10"), pm25 = h.getJSONArray("pm2_5");
            int worst = -1;
            for (int i = 9; i <= 21 && i < pm10.length() && i < pm25.length(); i++) {
                if (pm10.isNull(i) || pm25.isNull(i)) continue;
                double a = pm10.getDouble(i), b = pm25.getDouble(i);
                int g10 = a <= 30 ? 0 : a <= 80 ? 1 : a <= 150 ? 2 : 3;
                int g25 = b <= 15 ? 0 : b <= 35 ? 1 : b <= 75 ? 2 : 3;
                worst = Math.max(worst, Math.max(g10, g25));
            }
            return worst < 0 ? null : worst;
        } catch (Exception e) {
            return null;
        }
    }

    static String get(String url, int timeoutMs) {
        HttpURLConnection h = null;
        try {
            h = (HttpURLConnection) new URL(url).openConnection();
            h.setConnectTimeout(timeoutMs);
            h.setReadTimeout(timeoutMs);
            if (h.getResponseCode() != 200) return null;
            try (InputStream in = h.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return out.toString("UTF-8");
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (h != null) h.disconnect();
        }
    }

    /**
     * 디버그 빌드에서만: 시험용 예보 주소 (forecast.json·air.json 이 있는 곳). 릴리스 APK 는 늘 Open-Meteo.
     *   adb shell setprop debug.eojeboda.meteo http://localhost:8765/meteo
     */
    static String debugBase(Context c) {
        if ((c.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) return null;
        try {
            Process p = Runtime.getRuntime().exec(new String[] { "getprop", "debug.eojeboda.meteo" });
            try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()))) {
                String o = r.readLine();
                return o != null && o.trim().startsWith("http") ? o.trim() : null;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
