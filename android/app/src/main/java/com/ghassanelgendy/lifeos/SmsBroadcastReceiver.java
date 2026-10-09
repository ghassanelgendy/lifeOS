package com.ghassanelgendy.lifeos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Intercepts incoming bank SMS alerts and posts them directly to
 * LifeOS Supabase Edge Function `/functions/v1/process-sms`.
 * Zero user friction: automatically parses amounts, categories, and inserts transactions.
 */
public class SmsBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "LifeOSSmsReceiver";
    private static final String PREFS_NAME = "LifeOSNativePrefs";
    private static final String KEY_USER_ID = "lifeos_user_id";
    private static final String KEY_SUPABASE_URL = "lifeos_supabase_url";
    private static final String KEY_SUPABASE_ANON = "lifeos_supabase_anon";
    private static final String DEFAULT_SUPABASE_URL = "https://wckvsmeymvwchwweadfs.supabase.co";

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null || pdus.length == 0) return;

        StringBuilder fullMessage = new StringBuilder();
        String sender = "";

        for (Object pdu : pdus) {
            SmsMessage message;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                message = SmsMessage.createFromPdu((byte[]) pdu, format);
            } else {
                message = SmsMessage.createFromPdu((byte[]) pdu);
            }
            if (message != null) {
                if (sender.isEmpty()) {
                    sender = message.getDisplayOriginatingAddress();
                }
                fullMessage.append(message.getMessageBody());
            }
        }

        String msgText = fullMessage.toString().trim();
        if (msgText.isEmpty()) return;

        Log.d(TAG, "Received SMS from: " + sender);

        // Get saved User ID
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString(KEY_USER_ID, null);

        if (userId == null || userId.trim().isEmpty()) {
            Log.w(TAG, "No user ID configured yet. SMS cannot be sent to LifeOS.");
            return;
        }

        String supabaseUrl = prefs.getString(KEY_SUPABASE_URL, DEFAULT_SUPABASE_URL);
        String supabaseAnon = prefs.getString(KEY_SUPABASE_ANON, null);

        final String finalSender = sender;
        executor.execute(() -> {
            postSmsToLifeOS(supabaseUrl, supabaseAnon, userId, finalSender, msgText);
        });
    }

    private void postSmsToLifeOS(String supabaseUrl, String supabaseAnon, String userId, String sender, String message) {
        HttpURLConnection conn = null;
        try {
            String endpoint = supabaseUrl.replaceAll("/+$", "") + "/functions/v1/process-sms";
            URL url = new URL(endpoint);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            if (supabaseAnon != null && !supabaseAnon.isEmpty()) {
                conn.setRequestProperty("apikey", supabaseAnon);
                conn.setRequestProperty("Authorization", "Bearer " + supabaseAnon);
            }
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setDoOutput(true);

            JSONObject json = new JSONObject();
            json.put("message", message);
            json.put("user_id", userId);
            json.put("sender", sender);
            json.put("rawSms", message);

            JSONObject deviceInfo = new JSONObject();
            deviceInfo.put("platform", "android");
            deviceInfo.put("source", "native_broadcast_receiver");
            json.put("deviceInfo", deviceInfo);

            byte[] postData = json.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(postData);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "Posted SMS to LifeOS successfully. Status code: " + responseCode);
        } catch (Exception e) {
            Log.e(TAG, "Failed to post SMS to LifeOS", e);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
