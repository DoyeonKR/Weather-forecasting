package com.doyeonkr.weather;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 앱 안에서 새 버전 받기 (웹: src/lib/appUpdate.ts).
 *  info    — 지금 설치된 버전, 다른 앱 설치 허용 여부.
 *  install — GitHub Releases 의 최신 APK 를 받아 안드로이드 설치 창을 띄운다.
 *
 * 안전장치
 *  · 받는 주소는 여기 고정(APK_URL) — 웹이 주소를 넘기지 않는다. 사이트가 뚫려도 다른 APK 를 깔게 할 수 없다.
 *  · 받은 파일이 이 앱(같은 패키지)이고 지금보다 새 버전일 때만 설치한다.
 *  · 서명이 다르면 안드로이드가 설치를 거절한다(같은 서명 키로 만든 APK 만 덮어 설치된다).
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdate extends Plugin {
    static final String APK_URL = "https://github.com/DoyeonKR/Weather-forecasting/releases/latest/download/eojeboda-weather.apk";
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static volatile boolean busy = false;

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        PackageInfo me = self(getContext());
        r.put("versionName", me == null ? "" : me.versionName);
        r.put("versionCode", me == null ? 0 : versionCode(me));
        r.put("canInstall", canInstall(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context c = getContext();
        if (!canInstall(c)) {
            // 처음 한 번: "이 앱에서 다른 앱 설치 허용" 설정 화면으로. 켜고 돌아와서 다시 누르면 된다
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            resolve(call, "need_permission");
            return;
        }
        if (busy) {
            resolve(call, "busy");
            return;
        }
        busy = true;
        IO.execute(() -> {
            try {
                File apk = new File(c.getCacheDir(), "update.apk");
                download(apkUrl(c), apk);
                String check = verify(c, apk);
                if (check != null) {
                    resolve(call, check);
                    return;
                }
                startInstall(c, apk);
                resolve(call, "installing");
            } catch (Exception e) {
                resolve(call, "failed");
            } finally {
                busy = false;
            }
        });
    }

    /**
     * 받을 주소. 디버그 빌드에서만 시험용 주소로 바꿀 수 있다 (릴리스 APK 는 항상 APK_URL):
     *   adb shell setprop debug.eojeboda.update_url http://localhost:8765/eojeboda-weather.apk
     */
    static String apkUrl(Context c) {
        if ((c.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            try {
                Process p = Runtime.getRuntime().exec(new String[] { "getprop", "debug.eojeboda.update_url" });
                try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()))) {
                    String o = r.readLine();
                    if (o != null && !o.trim().isEmpty()) return o.trim();
                }
            } catch (Exception ignored) {
                // 기본 주소로
            }
        }
        return APK_URL;
    }

    private static void resolve(PluginCall call, String status) {
        JSObject r = new JSObject();
        r.put("status", status);
        call.resolve(r);
    }

    static boolean canInstall(Context c) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || c.getPackageManager().canRequestPackageInstalls();
    }

    static PackageInfo self(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException e) {
            return null;
        }
    }

    @SuppressWarnings("deprecation")
    static long versionCode(PackageInfo p) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode;
    }

    /** 받은 파일이 이 앱의 더 새 버전인가. 문제 없으면 null, 아니면 웹에 돌려줄 상태 */
    static String verify(Context c, File apk) {
        PackageInfo got = c.getPackageManager().getPackageArchiveInfo(apk.getPath(), 0);
        PackageInfo me = self(c);
        if (got == null || !c.getPackageName().equals(got.packageName)) return "failed";
        if (me != null && versionCode(got) <= versionCode(me)) return "up_to_date"; // 릴리스가 아직 안 올라온 경우 등
        return null;
    }

    /** 연결 15초 · 읽기 60초. GitHub 은 두 번 넘겨주므로(→ objects.githubusercontent.com) 따라간다 */
    static void download(String url, File to) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        h.setConnectTimeout(15_000);
        h.setReadTimeout(60_000);
        h.setInstanceFollowRedirects(true);
        try {
            if (h.getResponseCode() != 200) throw new Exception("http " + h.getResponseCode());
            try (InputStream in = h.getInputStream(); OutputStream out = new FileOutputStream(to)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
        } finally {
            h.disconnect();
        }
    }

    /** 안드로이드 설치 창. 12+ 에서 이 앱이 직접 설치한 적이 있으면 묻지 않고 업데이트될 수도 있다 */
    static void startInstall(Context c, File apk) throws Exception {
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(c.getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }
        int id = pi.createSession(params);
        try (PackageInstaller.Session s = pi.openSession(id)) {
            try (InputStream in = new FileInputStream(apk); OutputStream out = s.openWrite("base.apk", 0, apk.length())) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                s.fsync(out);
            }
            Intent done = new Intent(c, UpdateResultReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
            PendingIntent p = PendingIntent.getBroadcast(c, id, done, flags);
            s.commit(p.getIntentSender());
        }
    }
}
