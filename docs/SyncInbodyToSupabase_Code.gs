/**
 * WORKING monthly sync for pivot-style sheet:
 * Row 1: months (DEC, JAN, FEB...) then Difference, Status, Goal Next Month
 * Col A: metric names
 *
 * This script:
 * - detects month columns up to "Difference"
 * - auto-infers years based on current date + month rollover
 * - syncs ALL filled month columns every run (upsert overwrites by user_id+date)
 * - sends to Supabase Edge Function securely using x-sync-token + Authorization (anon key)
 */

function syncInbodyToSupabase() {
  const props = PropertiesService.getScriptProperties();

  // ===== REQUIRED SCRIPT PROPERTIES =====
  const SUPABASE_URL = props.getProperty("SUPABASE_URL");       // https://xxxx.supabase.co
  const EDGE_FUNCTION_PATH = props.getProperty("EDGE_FUNCTION_PATH") || "/functions/v1/sync-inbody";
  const SYNC_TOKEN = props.getProperty("SYNC_TOKEN");           // same as Supabase secret SYNC_TOKEN
  const ANON_KEY = props.getProperty("ANON_KEY");               // Supabase anon key (required by gateway)
  const USER_ID = props.getProperty("USER_ID");                 // auth.users uuid
  var SHEET_NAME = props.getProperty("SHEET_NAME") || SpreadsheetApp.getActiveSheet().getName();

  if (!SUPABASE_URL || !SYNC_TOKEN || !USER_ID || !ANON_KEY) {
    throw new Error("Missing Script Properties: SUPABASE_URL, SYNC_TOKEN, USER_ID, ANON_KEY");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error("Sheet not found: " + SHEET_NAME);

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error("Sheet seems empty or missing rows.");

  const header = data[0];
  const monthCols = getMonthColumns(header);

  if (monthCols.length === 0) {
    throw new Error("No month columns found. Ensure headers are like DEC, JAN, FEB... and stop before Difference.");
  }

  // Build row index map (metric name in column A)
  const metricRowMap = buildMetricRowMap(data);

  // Map sheet metrics -> DB fields (based on your exact labels)
  const rows = {
    weight: mustFindRow(metricRowMap, ["Weight (kg)", "Weight"]),
    skeletal_muscle_mass: mustFindRow(metricRowMap, ["Skeletal Muscle Mass (kg)", "Skeletal Muscle Mass", "SMM"]),
    body_fat_mass: mustFindRow(metricRowMap, ["Fat Mass (kg)", "Fat Mass"]),
    body_fat_percent: mustFindRow(metricRowMap, ["Body Fat Percentage (%)", "Body Fat Percentage", "PBF"]),
    visceral_fat_level: mustFindRow(metricRowMap, ["Visceral Fat Level", "Visceral Fat"]),
    bmr_kcal: mustFindRow(metricRowMap, ["BMR (Calories)", "BMR"])
  };

  // Find the latest filled month column (based on any key metric cell having a number)
  const latestFilled = findLatestFilledMonthCol(data, monthCols, rows);
  if (!latestFilled) {
    Logger.log("No filled month data found.");
    return;
  }

  // Infer year for each month column automatically
  const colYearMap = inferYearsForMonthColumns(monthCols, latestFilled);

  // Build payload records - sync ALL filled month columns every run
  var records = [];

  for (var mcIdx = 0; mcIdx < monthCols.length; mcIdx++) {
    var mc = monthCols[mcIdx];
    var col = mc.colIndex;

    var year = colYearMap[col];
    var dateStr = formatDateISO(year, mc.monthNum, 1); // first day of month

    var record = {
      date: dateStr,
      // DB schema columns:
      weight: toNumber(data[rows.weight][col]),
      skeletal_muscle_mass: toNumber(data[rows.skeletal_muscle_mass][col]),
      body_fat_mass: toNumber(data[rows.body_fat_mass][col]),
      body_fat_percent: toNumber(data[rows.body_fat_percent][col]),
      visceral_fat_level: toNumber(data[rows.visceral_fat_level][col]),
      bmr_kcal: toInt(data[rows.bmr_kcal][col])
    };

    // Skip months that are totally empty across the key metrics
    var hasAny =
      record.weight !== null ||
      record.skeletal_muscle_mass !== null ||
      record.body_fat_mass !== null ||
      record.body_fat_percent !== null ||
      record.visceral_fat_level !== null ||
      record.bmr_kcal !== null;

    if (!hasAny) continue;

    records.push(record);
  }

  if (records.length === 0) {
    Logger.log("Nothing to sync.");
    return;
  }

  // Send to Edge Function
  var url = SUPABASE_URL + EDGE_FUNCTION_PATH;
  callEdgeFunction(url, SYNC_TOKEN, ANON_KEY, USER_ID, records);

  Logger.log("Synced " + records.length + " record(s).");
}


// ===================== Helpers =====================

function getMonthColumns(headerRow) {
  const months = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };

  const cols = [];
  for (var c = 1; c < headerRow.length; c++) {
    var raw = (headerRow[c] || "").toString().trim().toUpperCase();

    // Stop at the first non-month (Difference is your boundary)
    if (raw === "DIFFERENCE" || raw === "STATUS" || raw === "GOAL NEXT MONTH") break;
    if (!months[raw]) break;

    cols.push({ colIndex: c, monthNum: months[raw], label: raw });
  }
  return cols;
}

function buildMetricRowMap(data) {
  var map = {};
  for (var r = 1; r < data.length; r++) {
    var key = (data[r][0] || "").toString().trim().toLowerCase();
    if (key) map[key] = r;
  }
  return map;
}

function mustFindRow(metricRowMap, names) {
  for (var i = 0; i < names.length; i++) {
    var key = names[i].toString().trim().toLowerCase();
    if (metricRowMap.hasOwnProperty(key)) return metricRowMap[key];
  }
  throw new Error("Missing row in sheet: " + names[0]);
}

function toNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function toInt(v) {
  var n = toNumber(v);
  return n === null ? null : Math.round(n);
}

function formatDateISO(year, month, day) {
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function findLatestFilledMonthCol(data, monthCols, rows) {
  // Scan from rightmost month column to leftmost; pick first with any numeric value
  for (var i = monthCols.length - 1; i >= 0; i--) {
    var col = monthCols[i].colIndex;

    var hasAny =
      toNumber(data[rows.weight][col]) !== null ||
      toNumber(data[rows.skeletal_muscle_mass][col]) !== null ||
      toNumber(data[rows.body_fat_mass][col]) !== null ||
      toNumber(data[rows.body_fat_percent][col]) !== null ||
      toNumber(data[rows.visceral_fat_level][col]) !== null ||
      toInt(data[rows.bmr_kcal][col]) !== null;

    if (hasAny) {
      return { colIndex: col, monthNum: monthCols[i].monthNum };
    }
  }
  return null;
}

function inferYearsForMonthColumns(monthCols, latestFilled) {
  // We infer based on today's date:
  // - The latestFilled month is assumed to be in current year unless it's "ahead" of current month -> then previous year.
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth() + 1;

  var latestYear = (latestFilled.monthNum > currentMonth) ? (currentYear - 1) : currentYear;

  // Assign years across all month columns based on rollover
  var map = {};
  var idx = -1;
  for (var i = 0; i < monthCols.length; i++) {
    if (monthCols[i].colIndex === latestFilled.colIndex) { idx = i; break; }
  }
  if (idx === -1) throw new Error("Latest filled column not found among month columns.");

  map[latestFilled.colIndex] = latestYear;

  // Walk left (going backwards in time)
  var y = latestYear;
  var prevMonth = monthCols[idx].monthNum;
  for (var i = idx - 1; i >= 0; i--) {
    var m = monthCols[i].monthNum;
    if (m > prevMonth) y -= 1; // e.g., moving left: JAN -> DEC => previous year
    map[monthCols[i].colIndex] = y;
    prevMonth = m;
  }

  // Walk right (forward in time)
  y = latestYear;
  prevMonth = monthCols[idx].monthNum;
  for (var i = idx + 1; i < monthCols.length; i++) {
    var m = monthCols[i].monthNum;
    if (m < prevMonth) y += 1; // e.g., moving right: DEC -> JAN => next year
    map[monthCols[i].colIndex] = y;
    prevMonth = m;
  }

  return map;
}

function callEdgeFunction(url, syncToken, anonKey, userId, records) {
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ user_id: userId, records: records }),
    headers: {
      "Authorization": "Bearer " + anonKey,
      "x-sync-token": syncToken,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Edge Function error " + code + ": " + res.getContentText());
  }
}
