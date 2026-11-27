package com.doyeonkr.weather.notify;

import android.content.Context;

import com.doyeonkr.weather.R;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/** 말투 문구 (res/raw/persona_lines.json — persona.ts 에서 scripts/export-persona-lines.mjs 로 만든다) */
final class Lines {
    private Lines() {}

    static Map<String, String> load(Context c, String persona) {
        Map<String, String> m = new HashMap<>();
        try (InputStream in = c.getResources().openRawResource(R.raw.persona_lines)) {
            byte[] b = new byte[in.available()];
            int n = in.read(b);
            JSONObject all = new JSONObject(new String(b, 0, Math.max(n, 0), "UTF-8"));
            JSONObject one = all.optJSONObject(persona);
            if (one == null) one = all.getJSONObject("default");
            for (Iterator<String> it = one.keys(); it.hasNext(); ) {
                String k = it.next();
                m.put(k, one.getString(k));
            }
        } catch (Exception ignored) {
            // 문구 없이도 숫자 브리핑은 보낸다
        }
        return m;
    }
}
