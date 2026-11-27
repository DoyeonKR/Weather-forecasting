package com.doyeonkr.weather.notify;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.TimeZone;
import org.junit.Test;

public class SlotTest {
    private static final TimeZone KST = TimeZone.getTimeZone("Asia/Seoul");
    // 2026-11-27 06:00 KST
    private static final long SIX = 1795726800000L;

    @Test
    public void before_slot_is_today() {
        assertEquals(SIX + 90 * 60_000L, Slot.next("0730", SIX, false, KST));
    }

    @Test
    public void just_missed_and_not_sent_fires_soon() {
        long t = SIX + 100 * 60_000L; // 07:40
        assertEquals(t + 60_000L, Slot.next("0730", t, false, KST));
    }

    @Test
    public void missed_but_already_sent_is_tomorrow() {
        long t = SIX + 100 * 60_000L;
        assertEquals(SIX + 90 * 60_000L + 24 * 3600_000L, Slot.next("0730", t, true, KST));
    }

    @Test
    public void hours_late_is_tomorrow() {
        long t = SIX + 5 * 3600_000L; // 11:00
        assertEquals(SIX + 90 * 60_000L + 24 * 3600_000L, Slot.next("0730", t, false, KST));
    }

    @Test
    public void due_window() {
        long slot = SIX + 90 * 60_000L;
        assertTrue(Slot.due("0730", slot + 5 * 60_000L, KST));
        assertTrue(Slot.due("0730", slot - 5 * 60_000L, KST));
        assertFalse(Slot.due("0730", slot + 3 * 3600_000L, KST));
        assertFalse(Slot.due("0730", slot - 60 * 60_000L, KST));
    }

    @Test
    public void day_and_valid() {
        assertEquals("2026-11-27", Slot.day(SIX, KST));
        assertTrue(Slot.valid("2130"));
        assertFalse(Slot.valid("2560"));
        assertFalse(Slot.valid("730"));
    }
}
