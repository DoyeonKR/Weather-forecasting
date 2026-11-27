package com.doyeonkr.weather.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.TimeZone;
import org.junit.Test;

public class WidgetRainTest {
    private static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");
    // 2026-11-27 14:00 KST
    private static final long T14 = 1795726800000L + 8 * 3600_000L;

    @Test
    public void hours_until() {
        double[] h = new double[72];
        h[24 + 18] = 0.4; // 오늘 18시
        assertEquals(4, WidgetRain.hoursUntil(h, 24 + 14));
        h[24 + 14] = 0.2;
        assertEquals(0, WidgetRain.hoursUntil(h, 24 + 14));
        assertEquals(-1, WidgetRain.hoursUntil(new double[72], 24 + 14));
        double[] drizzle = new double[72];
        drizzle[24 + 15] = 0.05;
        assertEquals(-1, WidgetRain.hoursUntil(drizzle, 24 + 14));
    }

    @Test
    public void labels() {
        assertEquals("18시 비", WidgetRain.label(T14 + 4 * 3600_000L, T14, KST));
        assertEquals("내일 6시 비", WidgetRain.label(T14 + 16 * 3600_000L, T14, KST));
        assertEquals("지금 비", WidgetRain.label(T14 - 30 * 60_000L, T14, KST));
        assertNull(WidgetRain.label(T14 - 3 * 3600_000L, T14, KST));
        assertNull(WidgetRain.label(0, T14, KST));
    }
}
