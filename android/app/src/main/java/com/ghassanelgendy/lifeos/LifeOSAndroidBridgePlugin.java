package com.ghassanelgendy.lifeos;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "LifeOSAndroidBridge",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }
        )
    }
)
public class LifeOSAndroidBridgePlugin extends Plugin {
    private static final String TAG = "LifeOSAndroidBridge";
    private static final String PREFS_NAME = "LifeOSNativePrefs";
    private static final String KEY_USER_ID = "lifeos_user_id";
    private static final String KEY_SUPABASE_URL = "lifeos_supabase_url";
    private static final String KEY_SUPABASE_ANON = "lifeos_supabase_anon";
    private static final String UNIQUE_WORK_NAME = "LifeOSDailyScreenTimeWork";

    @PluginMethod
    public void configureUser(PluginCall call) {
        String userId = call.getString("userId");
        String supabaseUrl = call.getString("supabaseUrl", "https://wckvsmeymvwchwweadfs.supabase.co");
        String supabaseAnon = call.getString("supabaseAnonKey", "");

        if (userId == null || userId.trim().isEmpty()) {
            call.reject("userId is required");
            return;
        }

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_USER_ID, userId.trim())
            .putString(KEY_SUPABASE_URL, supabaseUrl)
            .putString(KEY_SUPABASE_ANON, supabaseAnon)
            .apply();

        Log.i(TAG, "Configured LifeOS User ID for native background services: " + userId);

        // Schedule periodic ScreenTime worker every 4 hours
        schedulePeriodicScreenTimeSync(context);

        JSObject ret = new JSObject();
        ret.put("configured", true);
        ret.put("userId", userId);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAutomationStatus(PluginCall call) {
        Context context = getContext();
        boolean hasSms = ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        boolean hasUsageStats = ScreenTimeWorker.hasUsageStatsPermission(context);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(KEY_USER_ID, null);

        JSObject ret = new JSObject();
        ret.put("isAndroid", true);
        ret.put("hasSmsPermission", hasSms);
        ret.put("hasUsageStatsPermission", hasUsageStats);
        ret.put("isConfigured", userId != null && !userId.isEmpty());
        ret.put("configuredUserId", userId);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestUsageStatsPermission(PluginCall call) {
        Context context = getContext();
        if (ScreenTimeWorker.hasUsageStatsPermission(context)) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("openedSettings", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open Usage Access Settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void triggerScreenTimeSyncNow(PluginCall call) {
        Context context = getContext();
        androidx.work.OneTimeWorkRequest oneTimeRequest =
                new androidx.work.OneTimeWorkRequest.Builder(ScreenTimeWorker.class).build();
        WorkManager.getInstance(context).enqueue(oneTimeRequest);

        JSObject ret = new JSObject();
        ret.put("triggered", true);
        call.resolve(ret);
    }

    private void schedulePeriodicScreenTimeSync(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

        PeriodicWorkRequest workRequest =
                new PeriodicWorkRequest.Builder(ScreenTimeWorker.class, 4, TimeUnit.HOURS)
                        .setConstraints(constraints)
                        .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                workRequest
        );
        Log.i(TAG, "Enqueued periodic WorkManager job for screen time");
    }
}
