import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // ---- Custom Token Security (NO Supabase JWT) ----
    const token = req.headers.get("x-sync-token") ?? "";
    const expected = Deno.env.get("SYNC_TOKEN") ?? "";

    if (!expected || token !== expected) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    const body = await req.json();
    const { user_id, records } = body ?? {};

    if (!user_id || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Force correct structure
    const payload = records.map((r: any) => ({
      user_id,
      date: r.date,
      weight: r.weight ?? null,
      skeletal_muscle_mass: r.skeletal_muscle_mass ?? null,
      body_fat_mass: r.body_fat_mass ?? null,
      body_fat_percent: r.body_fat_percent ?? null,
      visceral_fat_level: r.visceral_fat_level ?? null,
      bmr_kcal: r.bmr_kcal ?? null,
    }));

    const { error } = await supabase
      .from("inbody_scans")
      .upsert(payload, { onConflict: "user_id,date" });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inserted: payload.length }),
      { headers: { "content-type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
});
