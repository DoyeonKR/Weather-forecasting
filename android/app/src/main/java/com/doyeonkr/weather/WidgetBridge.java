package com.doyeonkr.weather;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

import com.doyeonkr.weather.widget.WeatherWidget;
import com.doyeonkr.weather.widget.WidgetStore;
import com.doyeonkr.weather.widget.WidgetWorker;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 웹앱 ↔ 위젯 다리 (웹: src/lib/nativeWidget.ts).
 *  setPlace — 앱에서 보고 있는 장소를 위젯에 넘긴다. 바뀌었거나 오래됐으면 바로 다시 받는다.
 *  pin      — "홈 화면에 위젯 추가" 시스템 창을 띄운다 (안드로이드 8+, 런처가 지원할 때).
 *  info     — 추가 창을 띄울 수 있는지, 이미 놓인 위젯 수.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    @PluginMethod
    public void setPlace(PluginCall call) {
        Double lat = call.getDouble("lat");
        Double lon = call.getDouble("lon");
        String label = call.getString("label", "");
        if (lat == null || lon == null) {
            call.reject("lat/lon required");
            return;
        }
        Context c = getContext();
        boolean changed = WidgetStore.placeChanged(c, lat, lon);
        WidgetStore.savePlace(c, lat, lon, label);
        if (changed || System.currentTimeMillis() - WidgetStore.fetchedAt(c) > 10 * 60 * 1000L) {
            WidgetWorker.refreshNow(c);
        } else {
            WidgetStore.renderAll(c); // 이름만 바뀐 경우
        }
        call.resolve();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager m = getContext().getSystemService(AppWidgetManager.class);
            if (m != null && m.isRequestPinAppWidgetSupported()) {
                ok = m.requestPinAppWidget(new ComponentName(getContext(), WeatherWidget.class), null, null);
            }
        }
        r.put("requested", ok);
        call.resolve(r);
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        boolean can = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager m = getContext().getSystemService(AppWidgetManager.class);
            can = m != null && m.isRequestPinAppWidgetSupported();
        }
        r.put("pinSupported", can);
        r.put("count", AppWidgetManager.getInstance(getContext())
            .getAppWidgetIds(new ComponentName(getContext(), WeatherWidget.class)).length);
        call.resolve(r);
    }
}
