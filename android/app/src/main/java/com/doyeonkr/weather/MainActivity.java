package com.doyeonkr.weather;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridge.class); // 앱 안 플러그인은 super.onCreate 전에 등록해야 웹에서 보인다
        registerPlugin(AppUpdate.class);
        super.onCreate(savedInstanceState);
    }
}
