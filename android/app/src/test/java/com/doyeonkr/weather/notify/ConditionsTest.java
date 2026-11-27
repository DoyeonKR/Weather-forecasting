package com.doyeonkr.weather.notify;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

/** 서버 runRain 과 같은 기준·문구인지 */
public class ConditionsTest {
    private static Map<String, String> lines() {
        Map<String, String> m = new HashMap<>();
        m.put("umbrella", "우산 챙기세요!");
        m.put("snow", "눈 소식이 있어요, 길 조심하세요!");
        m.put("mask", "마스크 챙기세요!");
        m.put("hot", "폭염이에요, 물 자주 드세요!");
        m.put("cold", "많이 추워요, 단단히 입으세요!");
        return m;
    }

    private static final long T0 = 1_800_000_000L;
    private static long[] slots(int n) {
        long[] t = new long[n];
        for (int i = 0; i < n; i++) t[i] = T0 + i * 900L;
        return t;
    }

    @Test
    public void rain_soon_within_an_hour() {
        Conditions.Soon s = Conditions.rainSoon(slots(8), new double[] { 0, 0, 0, 0.3, 1, 0, 0, 0 }, null, T0 + 60);
        assertEquals(T0 + 3 * 900L, s.startSec);
        assertFalse(s.snow);
    }

    @Test
    public void already_raining_is_quiet() {
        assertNull(Conditions.rainSoon(slots(8), new double[] { 0.2, 0.5, 0, 0, 0, 0, 0, 0 }, null, T0 + 60));
    }

    @Test
    public void rain_too_far_or_drizzle_is_quiet() {
        assertNull(Conditions.rainSoon(slots(10), new double[] { 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0 }, null, T0 + 60));
        assertNull(Conditions.rainSoon(slots(8), new double[] { 0, 0.05, 0.05, 0, 0, 0, 0, 0 }, null, T0 + 60));
    }

    @Test
    public void snow_when_snowfall() {
        Conditions.Soon s = Conditions.rainSoon(slots(6), new double[] { 0, 0.4, 0, 0, 0, 0 }, new double[] { 0, 0.7, 0, 0, 0, 0 }, T0 + 60);
        assertTrue(s.snow);
        assertEquals("🌂 수원시 곧 눈 소식", Conditions.rainMsg("수원시", 15, true, lines()).title);
        assertEquals("15시쯤부터 눈이 올 것 같아요. 눈 소식이 있어요, 길 조심하세요!", Conditions.rainMsg("수원시", 15, true, lines()).body);
        assertEquals("15시쯤부터 비가 올 것 같아요. 우산 챙기세요!", Conditions.rainMsg("수원시", 15, false, lines()).body);
    }

    @Test
    public void air_grade_and_message() {
        assertEquals(0, Conditions.airGrade(20, 10));
        assertEquals(2, Conditions.airGrade(90, 20));
        assertEquals(3, Conditions.airGrade(40, 80));
        assertNull(Conditions.airMsg("서울", 1, lines()));
        assertEquals("😷 서울 미세먼지 나쁨", Conditions.airMsg("서울", 2, lines()).title);
        assertEquals("😷 서울 미세먼지 매우 나쁨", Conditions.airMsg("서울", 3, lines()).title);
    }

    @Test
    public void heat_and_cold() {
        Brief.Msg hot = Conditions.tempMsg("대구", new Brief.Day(34.56, 25, 0, 0, 9), lines());
        assertEquals("🥵 대구 오늘 폭염", hot.title);
        assertEquals("낮 최고 34.6°. 폭염이에요, 물 자주 드세요!", hot.body);
        Brief.Msg cold = Conditions.tempMsg("철원", new Brief.Day(-3, -12, 0, 0, 1), lines());
        assertEquals("아침 최저 -12°. 많이 추워요, 단단히 입으세요!", cold.body);
        assertNull(Conditions.tempMsg("서울", new Brief.Day(20, 5, 0, 0, 1), lines()));
    }

    @Test
    public void quiet_hours() {
        assertFalse(Conditions.awakeHour(6));
        assertTrue(Conditions.awakeHour(7));
        assertTrue(Conditions.awakeHour(21));
        assertFalse(Conditions.awakeHour(22));
    }
}
