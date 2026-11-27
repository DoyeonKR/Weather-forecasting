package com.doyeonkr.weather;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.doyeonkr.weather.notify.Notifier;
import com.doyeonkr.weather.notify.NotifyApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * 앱 날씨 알림 (웹: src/lib/appNotify.ts). 웹뷰는 웹 푸시를 못 받아서, 앱이 직접 아침·밤에 예보를 받아 알림을 만든다.
 *  info    — 켜져 있나, 알림을 띄울 수 있나(권한), 시간·지역
 *  enable  — (안드로이드 13+ 권한을 물은 뒤) 켜고 알람을 건다
 *  disable — 끄고 알람을 지운다
 *  update  — 기준 지역(기본 지역)·말투·시간이 바뀌면 (켜져 있을 때만 알람을 다시 건다)
 *  test    — 지금 한 통
 *  openSettings — 알림을 막아 뒀을 때 이 앱의 알림 설정 화면
 *  requestBatteryExemption — 배터리 최적화에서 빼기 (제조사 절전이 알림을 늦출 때)
 */
@CapacitorPlugin(
    name = "AppNotify",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class AppNotify extends Plugin {
    @PluginMethod
    public void info(PluginCall call) {
        call.resolve(NotifyApi.info(getContext()));
    }

    @PluginMethod
    public void enable(PluginCall call) {
        NotifyApi.save(getContext(), call.getData());
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterPermission");
            return;
        }
        finishEnable(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("status", "denied");
            call.resolve(r);
            return;
        }
        finishEnable(call);
    }

    private void finishEnable(PluginCall call) {
        JSObject r = new JSObject();
        // 안드로이드 12 이하는 권한 창이 없다 — 설정에서 이 앱 알림을 꺼 뒀으면 켜지 않고 알린다
        if (!Notifier.allowed(getContext())) {
            r.put("status", "blocked");
            call.resolve(r);
            return;
        }
        NotifyApi.enable(getContext());
        r.put("status", "on");
        call.resolve(r);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        NotifyApi.disable(getContext());
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        NotifyApi.save(getContext(), call.getData());
        NotifyApi.reschedule(getContext());
        call.resolve();
    }

    @PluginMethod
    public void test(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        if (!Notifier.allowed(c)) {
            r.put("status", "blocked");
            call.resolve(r);
            return;
        }
        new Thread(() -> {
            r.put("status", NotifyApi.test(c) ? "sent" : "failed");
            call.resolve(r);
        }).start();
    }

    /** 배터리 최적화(절전)에서 빼 달라는 시스템 창 — 안 되면 목록 화면으로 */
    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        Context c = getContext();
        try {
            c.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, android.net.Uri.parse("package:" + c.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            c.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        }
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context c = getContext();
        Intent i = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName())
            : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + c.getPackageName()));
        c.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        call.resolve();
    }
}
