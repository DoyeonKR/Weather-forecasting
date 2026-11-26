package com.doyeonkr.weather;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Message;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

import java.net.URISyntaxException;

/**
 * 웹뷰의 "새 창 열기"를 밖(쿠팡 앱·브라우저)으로 넘긴다.
 * 쿠팡 광고는 iframe 안에서 target="_blank" 로 새 창을 연다. 브라우저는 이걸 쿠팡 앱으로 넘기지만,
 * 웹뷰는 새 창을 지원하지 않아 앱에서만 눌러도 아무 일이 없었다(2026-11-26 제보).
 *  · 사용자가 누른 것만 연다 (누르지 않았는데 뜨는 팝업은 막는다)
 *  · 임시 웹뷰로 첫 주소만 받아 Intent 로 넘기고 버린다 — 앱 안에 새 창을 띄우지 않는다
 */
final class ExternalWindows {
    private ExternalWindows() {}

    static void install(Bridge bridge) {
        WebView wv = bridge.getWebView();
        wv.getSettings().setSupportMultipleWindows(true);
        wv.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        wv.setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture) return false;
                Context c = view.getContext();
                WebView temp = new WebView(c);
                temp.setWebViewClient(new WebViewClient() {
                    private boolean done = false;

                    private void handoff(WebView v, String url) {
                        if (done || url == null || url.isEmpty() || url.equals("about:blank")) return;
                        done = true;
                        openExternal(c, url);
                        v.stopLoading();
                        v.post(v::destroy);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                        handoff(v, r.getUrl().toString());
                        return true;
                    }

                    // 새 창의 첫 주소는 shouldOverrideUrlLoading 을 거치지 않는 경우가 있다
                    @Override
                    public void onPageStarted(WebView v, String url, android.graphics.Bitmap favicon) {
                        handoff(v, url);
                    }
                });
                WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
                t.setWebView(temp);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }

    /** https 는 그 주소를 여는 앱(쿠팡 앱 · 없으면 브라우저)으로, intent: 는 그 앱으로(없으면 대체 주소) */
    static void openExternal(Context c, String url) {
        try {
            Intent i;
            if (url.startsWith("intent:")) {
                i = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                i.addCategory(Intent.CATEGORY_BROWSABLE);
                i.setComponent(null);
                i.setSelector(null);
            } else {
                i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addCategory(Intent.CATEGORY_BROWSABLE);
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                c.startActivity(i);
            } catch (ActivityNotFoundException e) {
                String fallback = i.getStringExtra("browser_fallback_url");
                if (fallback != null && fallback.startsWith("http")) {
                    c.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                }
            }
        } catch (URISyntaxException | ActivityNotFoundException ignored) {
            // 열 수 있는 앱이 없으면 조용히 넘어간다
        }
    }
}
