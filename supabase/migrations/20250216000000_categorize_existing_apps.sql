-- Categorize all existing app rows in screentime_daily_app_stats
-- This migration updates all rows with NULL or 'Uncategorized' category

UPDATE screentime_daily_app_stats
SET category = CASE
  -- Development Tools
  WHEN LOWER(TRIM(app_name)) IN ('code', 'cursor', 'windowsterminal', 'notepad', 'jetbrains-toolbox', 'githubdesktop', 'powershell', 'visual studio code', 'vscode') 
    THEN 'Development'
  
  -- Productivity
  WHEN LOWER(TRIM(app_name)) IN ('ticktick', 'icloudpasswords', 'icloudpasswordsextensionhelper', 'excel', 'powerpnt', 'powerpoint', 'word', 'onenote', 'outlook', 'notes', 'reminders', 'calendar', 'google calendar', 'shortcuts', 'zoho desk', 'gemini', 'chatgpt')
    THEN 'Productivity'
  
  -- Utilities
  WHEN LOWER(TRIM(app_name)) IN ('snippingtool', 'winrar', 'calculator', 'cleanmgr', 'disk cleanup')
    THEN 'Utilities'
  
  -- Entertainment
  WHEN LOWER(TRIM(app_name)) IN ('vlc', 'applemusic', 'itunes', 'music', 'youtube', 'tiktok', 'instagram', 'netflix', 'spotify')
    THEN 'Entertainment'
  
  -- Communication
  WHEN LOWER(TRIM(app_name)) IN ('whatsapp.root', 'whatsapp', 'wa business', 'messages', 'mail', 'facetime', 'telegram', 'signal', 'discord', 'slack', 'phone', 'incallservice')
    THEN 'Communication'
  
  -- Web Browsing (exact matches for Windows system browsers)
  WHEN LOWER(TRIM(app_name)) = 'shellexperiencehost' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) = 'msiexec' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) = 'startmenuexperiencehost' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) = 'explorer' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) = 'msedge' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) IN ('safari', 'chrome', 'firefox', 'web')
    THEN 'Web Browsing'
  
  -- Social Media
  WHEN LOWER(TRIM(app_name)) IN ('facebook', 'twitter', 'x', 'linkedin', 'reddit', 'snapchat')
    THEN 'Social'
  
  -- Media (Photo & Video Editing)
  WHEN LOWER(TRIM(app_name)) IN ('photoshop', 'capcut', 'snapseed', 'picsart', 'photos', 'vn', 'edits', 'premiere', 'after effects', 'lightroom')
    THEN 'Media'
  
  -- Finance & Banking
  WHEN LOWER(TRIM(app_name)) IN ('qnb bebasata', 'myfawry', 'thndr', 'instapay', 'noon')
    THEN 'Finance'
  
  -- Health & Fitness
  WHEN LOWER(TRIM(app_name)) IN ('health', 'huawei health', 'apple health', 'fitness', 'strava')
    THEN 'Health'
  
  -- Navigation
  WHEN LOWER(TRIM(app_name)) IN ('google maps', 'maps', 'waze', 'apple maps')
    THEN 'Navigation'
  
  -- Gaming
  WHEN LOWER(TRIM(app_name)) IN ('ld', 'steam', 'epic games')
    THEN 'Gaming'
  
  -- System & Settings
  WHEN LOWER(TRIM(app_name)) IN ('settings', 'clock', 'app store', 'softwareupdate', 'applicationframehost', 'shellhost', 'searchhost', 'pickerhost', 'credentialuibroker', 'lockapp', 'user authentication', 'authkituiservice', 'ctnotifyuiservice', 'synetpenh', 'keyboarddrv', 'vedetector', 'rdcfg', 'mmc', 'compil32', 'mspcmanager', 'screentimeunlock', 'chronos-screentime', 'lifeos', 'appledevices', 'olk', 'openwith')
    THEN 'System'
  
  -- Cloud & Storage
  WHEN LOWER(TRIM(app_name)) IN ('icloudhome', 'drive', 'dropbox', 'onedrive', 'google drive')
    THEN 'Cloud'
  
  -- Pattern matching fallbacks
  WHEN LOWER(TRIM(app_name)) ~ 'code|editor|ide|studio|dev' THEN 'Development'
  WHEN LOWER(TRIM(app_name)) ~ 'terminal|cmd|powershell|bash|shell|console' THEN 'Development'
  WHEN LOWER(TRIM(app_name)) ~ 'git|github|gitlab|bitbucket|version control' THEN 'Development'
  WHEN LOWER(TRIM(app_name)) ~ 'browser|chrome|edge|firefox|safari|web|explorer' THEN 'Web Browsing'
  WHEN LOWER(TRIM(app_name)) ~ 'photo|image|picture|gallery|camera|snap' THEN 'Media'
  WHEN LOWER(TRIM(app_name)) ~ 'video|movie|film|player|vlc|media player' THEN 'Media'
  WHEN LOWER(TRIM(app_name)) ~ 'music|audio|sound|spotify|apple music|itunes|streaming' THEN 'Entertainment'
  WHEN LOWER(TRIM(app_name)) ~ 'message|chat|whatsapp|telegram|signal|messenger|sms' THEN 'Communication'
  WHEN LOWER(TRIM(app_name)) ~ 'mail|email|outlook|gmail|post' THEN 'Communication'
  WHEN LOWER(TRIM(app_name)) ~ 'social|facebook|twitter|instagram|linkedin|snapchat|tiktok' THEN 'Social'
  WHEN LOWER(TRIM(app_name)) ~ 'note|memo|notepad|text|document|write' THEN 'Productivity'
  WHEN LOWER(TRIM(app_name)) ~ 'calendar|schedule|reminder|todo|task|ticktick' THEN 'Productivity'
  WHEN LOWER(TRIM(app_name)) ~ 'bank|finance|payment|wallet|money|fawry|thndr|instapay' THEN 'Finance'
  WHEN LOWER(TRIM(app_name)) ~ 'health|fitness|workout|exercise|wellness' THEN 'Health'
  WHEN LOWER(TRIM(app_name)) ~ 'map|navigation|gps|location|directions' THEN 'Navigation'
  WHEN LOWER(TRIM(app_name)) ~ 'game|gaming|play|steam|epic' THEN 'Gaming'
  WHEN LOWER(TRIM(app_name)) ~ 'setting|config|preference|control panel|options' THEN 'System'
  WHEN LOWER(TRIM(app_name)) ~ 'system|windows|host|service|driver|process|exec|manager' THEN 'System'
  WHEN LOWER(TRIM(app_name)) ~ 'cloud|sync|backup|storage|icloud|drive|dropbox' THEN 'Cloud'
  WHEN LOWER(TRIM(app_name)) ~ 'utility|tool|helper|manager|clean|snipping|calculator' THEN 'Utilities'
  WHEN LOWER(TRIM(app_name)) ~ 'ai|assistant|chatgpt|gemini|claude' THEN 'Productivity'
  
  -- Default fallback (shouldn't happen with pattern matching, but just in case)
  ELSE 'Uncategorized'
END,
updated_at = timezone('utc'::text, now())
WHERE category IS NULL OR category = 'Uncategorized';

-- Show summary of categorization results
DO $$
DECLARE
  total_rows integer;
  categorized_rows integer;
  uncategorized_rows integer;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM screentime_daily_app_stats;
  SELECT COUNT(*) INTO categorized_rows FROM screentime_daily_app_stats WHERE category IS NOT NULL AND category != 'Uncategorized';
  SELECT COUNT(*) INTO uncategorized_rows FROM screentime_daily_app_stats WHERE category IS NULL OR category = 'Uncategorized';
  
  RAISE NOTICE 'Categorization complete:';
  RAISE NOTICE '  Total rows: %', total_rows;
  RAISE NOTICE '  Categorized: %', categorized_rows;
  RAISE NOTICE '  Uncategorized: %', uncategorized_rows;
END $$;
