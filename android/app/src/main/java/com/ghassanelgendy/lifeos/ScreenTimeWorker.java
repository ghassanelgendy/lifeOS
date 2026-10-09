package com.ghassanelgendy.lifeos;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Background WorkManager Worker to query Android UsageStatsManager
 * and upload daily screen time to LifeOS `/functions/v1/upload-screentime`.
 * Runs unobtrusively in the background without user intervention.
 */
public class ScreenTimeWorker extends Worker {
    private static final String TAG = "LifeOSScreenTimeWorker";
    private static final String PREFS_NAME = "LifeOSNativePrefs";
    private static final String KEY_USER_ID = "lifeos_user_id";
    private static final String KEY_SUPABASE_URL = "lifeos_supabase_url";
    private static final String KEY_SUPABASE_ANON = "lifeos_supabase_anon";
    private static final String DEFAULT_SUPABASE_URL = "https://wckvsmeymvwchwweadfs.supabase.co";

    public ScreenTimeWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    public static boolean hasUsageStatsPermission(Context context) {
        try {
            AppOpsManager appOps = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
            int mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    context.getPackageName()
            );
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();

        if (!hasUsageStatsPermission(context)) {
            Log.w(TAG, "PACKAGE_USAGE_STATS permission not granted. Cannot collect screentime.");
            return Result.success(); // don't retry endlessly if permission not granted
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(KEY_USER_ID, null);
        if (userId == null || userId.trim().isEmpty()) {
            Log.w(TAG, "No user ID configured. Skipping screentime upload.");
            return Result.success();
        }

        String supabaseUrl = prefs.getString(KEY_SUPABASE_URL, DEFAULT_SUPABASE_URL);
        String supabaseAnon = prefs.getString(KEY_SUPABASE_ANON, null);

        try {
            UsageStatsManager usageStatsManager = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usageStatsManager == null) return Result.success();

            // Calculate start and end of today
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, 0);
            calendar.set(Calendar.MINUTE, 0);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            long startTime = calendar.getTimeInMillis();
            long endTime = System.currentTimeMillis();

            List<UsageStats> usageStatsList = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    startTime,
                    endTime
            );

            if (usageStatsList == null || usageStatsList.isEmpty()) {
                Log.i(TAG, "No usage stats recorded for today yet.");
                return Result.success();
            }

            PackageManager pm = context.getPackageManager();
            JSONArray appsArray = new JSONArray();
            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.US);
            Date now = new Date();
            String todayStr = dateFormat.format(now);
            String currentTimeStr = timeFormat.format(now);

            int totalApps = 0;

            for (UsageStats stats : usageStatsList) {
                long totalTimeInForeground = stats.getTotalTimeInForeground();
                if (totalTimeInForeground < 1000) {
                    continue; // Skip less than 1 second
                }

                String packageName = stats.getPackageName();
                String appName = packageName;
                try {
                    ApplicationInfo appInfo = pm.getApplicationInfo(packageName, 0);
                    CharSequence label = pm.getApplicationLabel(appInfo);
                    if (label != null) {
                        appName = label.toString();
                    }
                } catch (PackageManager.NameNotFoundException ignored) {}

                long durationSeconds = totalTimeInForeground / 1000;
                JSONObject appObj = new JSONObject();
                appObj.put("app_name", appName);
                appObj.put("process_path", packageName);
                appObj.put("total_time_seconds", durationSeconds);
                appObj.put("duration_minutes", Math.round(durationSeconds / 60.0));
                if (stats.getLastTimeUsed() > 0) {
                    SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                    appObj.put("last_active_at", isoFormat.format(new Date(stats.getLastTimeUsed())));
                }

                appsArray.put(appObj);
                totalApps++;
            }

            if (appsArray.length() == 0) {
                Log.i(TAG, "No apps with active usage to upload.");
                return Result.success();
            }

            JSONObject payload = new JSONObject();
            payload.put("user_id", userId);
            payload.put("platform", "android");
            payload.put("source", "android_native");
            payload.put("upload_date", todayStr);
            payload.put("upload_time", currentTimeStr);
            payload.put("date", todayStr);
            payload.put("apps", appsArray);
            payload.put("total_apps", totalApps);

            uploadToLifeOS(supabaseUrl, supabaseAnon, payload);
            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "Error in ScreenTimeWorker", e);
            return Result.retry();
        }
    }

    private void uploadToLifeOS(String supabaseUrl, String supabaseAnon, JSONObject payload) throws Exception {
        HttpURLConnection conn = null;
        try {
            String endpoint = supabaseUrl.replaceAll("/+$", "") + "/functions/v1/upload-screentime";
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (supabaseAnon != null && !supabaseAnon.isEmpty()) {
                conn.setRequestProperty("apikey", supabaseAnon);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseAnon);
            }
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setDoOutput(true);

            byte[] postData = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(postData);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "ScreenTimeWorker uploaded stats successfully. Response code: " + responseCode);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
