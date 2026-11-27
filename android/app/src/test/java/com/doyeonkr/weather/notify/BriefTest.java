package com.doyeonkr.weather.notify;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

/** 서버 morningMsg·nightMsg 와 같은 문장이 나오는지 (서버 문구를 바꾸면 여기도) */
public class BriefTest {
    private static Map<String, String> lines() {
        Map<String, String> m = new HashMap<>();
        m.put("umbrella", "우산 챙기세요!");
        m.put("snow", "눈 소식이 있어요, 길 조심하세요!");
        m.put("mask", "마스크 챙기세요!");
        m.put("uv", "자외선이 강해요, 선크림 챙기세요!");
        m.put("coat", "겉옷 챙기세요!");
        m.put("light", "얇은 옷이 좋아요!");
        return m;
    }

    @Test
    public void morning_plain() {
        Brief.Msg m = Brief.morning("수원시", new Brief.Day(5, -1, 0, 1, 2), new Brief.Day(14, 3, 10, 1, 3), null, lines());
        assertEquals("☀️ 수원시 오늘 날씨 브리핑", m.title);
        assertEquals("오늘 3~14°, 낮 기온이 어제보다 9° 높아요.", m.body);
    }

    @Test
    public void morning_cold_rain_dust_uv() {
        Brief.Msg m = Brief.morning("서울", new Brief.Day(2.4, -5, 0, 1, 1), new Brief.Day(-8.2, -15.04, 70, 61, 9), 3, lines());
        assertEquals("오늘 -15~-8.2°, 낮 기온이 어제보다 10.6° 낮아요. 강수확률 70%, 우산 챙기세요! 미세먼지 매우 나쁨, 마스크 챙기세요! 자외선 매우 강함, 자외선이 강해요, 선크림 챙기세요!", m.body);
    }

    @Test
    public void morning_snow_wins_over_rain_and_similar() {
        Brief.Msg m = Brief.morning("평창", new Brief.Day(-1, -9, 0, 3, 1), new Brief.Day(-1.5, -9, 80, 73, 1), 2, lines());
        assertEquals("오늘 -9~-1.5°, 낮 기온이 어제와 비슷해요. 눈 소식이 있어요, 길 조심하세요! 미세먼지 나쁨, 마스크 챙기세요!", m.body);
    }

    @Test
    public void night_quiet_returns_null() {
        assertNull(Brief.night("수원시", new Brief.Day(10, 2, 10, 1, 1), new Brief.Day(11, 1, 20, 2, 1), lines()));
    }

    @Test
    public void night_cold_rain() {
        Brief.Msg m = Brief.night("수원시", new Brief.Day(10, 2, 10, 1, 1), new Brief.Day(4, -4, 60, 61, 1), lines());
        assertEquals("🌙 내일 출근 준비 (수원시)", m.title);
        assertEquals("내일 비 올 확률 60%. 우산 챙기세요! 내일 아침이 오늘보다 6° 추워요. 겉옷 챙기세요!", m.body);
    }

    @Test
    public void night_hot() {
        Brief.Msg m = Brief.night("부산", new Brief.Day(20, 12, 0, 1, 1), new Brief.Day(25.5, 13, 0, 1, 1), lines());
        assertEquals("내일은 오늘보다 5.5° 더워요. 얇은 옷이 좋아요!", m.body);
    }

    @Test
    public void test_message() {
        Brief.Msg m = Brief.test("수원시 매산로1가", "0730", "2130", lines());
        assertEquals("우산 챙기세요! 알림이 잘 도착해요. 수원시 매산로1가 기준으로 아침 07:30 브리핑, 밤 21:30 내일 준비 알림을 보내드려요.", m.body);
    }
}
