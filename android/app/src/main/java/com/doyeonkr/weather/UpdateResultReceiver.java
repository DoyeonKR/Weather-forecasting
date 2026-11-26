package com.doyeonkr.weather;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.widget.Toast;

/** 설치 진행 결과. 사용자 확인이 필요하면 안드로이드 설치 창을 띄우고, 실패하면 짧게 알린다 */
public class UpdateResultReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(confirm);
            }
            return;
        }
        if (status == PackageInstaller.STATUS_SUCCESS || status == PackageInstaller.STATUS_FAILURE_ABORTED) return; // 성공하면 앱이 새로 뜬다 · 취소는 조용히
        String msg = status == PackageInstaller.STATUS_FAILURE_CONFLICT || status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE
            ? "새 버전을 설치하지 못했어요. 앱을 지우고 새로 받아 주세요."
            : status == PackageInstaller.STATUS_FAILURE_STORAGE
            ? "저장 공간이 부족해 새 버전을 설치하지 못했어요."
            : "새 버전을 설치하지 못했어요. 잠시 후 다시 해 주세요.";
        Toast.makeText(c, msg, Toast.LENGTH_LONG).show();
    }
}
