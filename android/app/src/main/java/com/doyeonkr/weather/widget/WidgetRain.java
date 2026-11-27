package com.doyeonkr.weather.widget;

/**
 * 위젯 "다음 비" — 시간별 강수(어제 0시부터)에서 지금·앞으로 24시간 안의 비를 찾는다 (WidgetRainTest).
 * 0.1mm 미만은 비로 세지 않는다 (웹 lib/rainLane 과 같은 기준).
 */
public final class WidgetRain {
    private WidgetRain() {}

    static final double MIN_MM = 0.1;

    /** 지금 오나(0), 몇 시간 뒤 오나(1~24), 없으면 -1 */
    public static int hoursUntil(double[] hourly, int cur) {
        if (hourly == null || cur < 0 || cur >= hourly.length) return -1;
        for (int j = cur; j <= cur + 24 && j < hourly.length; j++) if (hourly[j] >= MIN_MM) return j - cur;
        return -1;
    }

    /**
     * 위젯 글자. rainAt: 비 시작 시각(ms, 그 시간 정각), 0 이면 없음. now 와 같은 날이면 "15시 비", 다음 날이면 "내일 6시 비",
     * 이미 시작했으면(지난 2시간 안) "지금 비". 그보다 오래된 값이면 null (다시 받기 전까지는 강수확률로).
     */
    public static String label(long rainAt, long now, java.util.TimeZone tz) {
        if (rainAt <= 0) return null;
        if (rainAt <= now) return now - rainAt < 2 * 3600_000L ? "지금 비" : null;
        java.util.Calendar a = java.util.Calendar.getInstance(tz), n = java.util.Calendar.getInstance(tz);
        a.setTimeInMillis(rainAt);
        n.setTimeInMillis(now);
        boolean sameDay = a.get(java.util.Calendar.YEAR) == n.get(java.util.Calendar.YEAR)
            && a.get(java.util.Calendar.DAY_OF_YEAR) == n.get(java.util.Calendar.DAY_OF_YEAR);
        return (sameDay ? "" : "내일 ") + a.get(java.util.Calendar.HOUR_OF_DAY) + "시 비";
    }
}
