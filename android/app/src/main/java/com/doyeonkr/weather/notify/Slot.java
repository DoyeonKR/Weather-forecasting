package com.doyeonkr.weather.notify;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * 알림 시각 계산 (안드로이드 의존 없음 — SlotTest).
 *  · 오늘 그 시각이 아직이면 오늘, 지났으면 내일
 *  · 단, 오늘 것을 아직 안 보냈고 지난 지 2시간 안이면 곧바로(1분 뒤) — 앱 업데이트·재부팅으로 알람이 사라졌다 다시 걸 때
 *  · 2시간 넘게 늦은 알림은 보내지 않는다 (아침 브리핑이 점심에 오면 오히려 헷갈린다)
 */
public final class Slot {
    private Slot() {}

    static final long LATE_MS = 2 * 60 * 60 * 1000L;

    /** 오늘(now 가 속한 날) hhmm 의 시각 */
    public static long todayAt(String hhmm, long now, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(now);
        c.set(Calendar.HOUR_OF_DAY, Integer.parseInt(hhmm.substring(0, 2)));
        c.set(Calendar.MINUTE, Integer.parseInt(hhmm.substring(2, 4)));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    /** now 가 속한 날짜 "yyyy-MM-dd" (하루 한 번 판정) */
    public static String day(long now, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(now);
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** 다음 알람 시각. sentToday: 오늘 이 알림을 이미 보냈나 */
    public static long next(String hhmm, long now, boolean sentToday, TimeZone tz) {
        long today = todayAt(hhmm, now, tz);
        if (today > now) return today;
        if (!sentToday && now - today < LATE_MS) return now + 60_000L;
        Calendar c = Calendar.getInstance(tz);
        c.setTimeInMillis(today);
        c.add(Calendar.DAY_OF_MONTH, 1); // 서머타임이 있는 곳에서도 "내일 같은 시각"
        return c.getTimeInMillis();
    }

    /** 지금 울린 알람으로 보내도 되나 — 시각 전이면(너무 일찍) 또는 2시간 넘게 늦었으면 안 보낸다 */
    public static boolean due(String hhmm, long now, TimeZone tz) {
        long today = todayAt(hhmm, now, tz);
        return now >= today - 10 * 60_000L && now - today < LATE_MS;
    }

    public static boolean valid(String hhmm) {
        if (hhmm == null || !hhmm.matches("\\d{4}")) return false;
        int h = Integer.parseInt(hhmm.substring(0, 2)), m = Integer.parseInt(hhmm.substring(2));
        return h < 24 && m < 60;
    }
}
