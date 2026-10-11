-- =========================================================
-- Supabase Migration: Quran Memorization & Khatmah Planner
-- Copy and paste this script directly into Supabase SQL Editor
-- =========================================================

-- 1. Create Hifdh / Spaced Repetition Records Table
CREATE TABLE IF NOT EXISTS public.quran_hifdh_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    surah_number INTEGER NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
    ayah_start INTEGER NOT NULL CHECK (ayah_start >= 1),
    ayah_end INTEGER NOT NULL CHECK (ayah_end >= ayah_start),
    status TEXT NOT NULL CHECK (status IN ('not_started', 'memorizing', 'reviewing', 'memorized')) DEFAULT 'memorizing',
    mastery_score INTEGER NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
    repeats_done INTEGER NOT NULL DEFAULT 0,
    interval_days INTEGER NOT NULL DEFAULT 1,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    last_reviewed_at TIMESTAMPTZ DEFAULT NOW(),
    next_review_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_surah_range UNIQUE(user_id, surah_number, ayah_start, ayah_end)
);

-- 2. Create Khatmah Plans Table
CREATE TABLE IF NOT EXISTS public.quran_khatmah_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'خطة حفظ القرآن الكريم',
    goal_type TEXT NOT NULL CHECK (goal_type IN ('pages_per_day', 'juz_in_days', 'target_date')) DEFAULT 'pages_per_day',
    pages_per_day INTEGER NOT NULL DEFAULT 1 CHECK (pages_per_day >= 1),
    start_page INTEGER NOT NULL DEFAULT 1 CHECK (start_page BETWEEN 1 AND 604),
    end_page INTEGER NOT NULL DEFAULT 604 CHECK (end_page BETWEEN start_page AND 604),
    current_page INTEGER NOT NULL DEFAULT 1 CHECK (current_page BETWEEN 1 AND 604),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    target_end_date TIMESTAMPTZ,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_completed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.quran_hifdh_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_khatmah_plans ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for quran_hifdh_records
DROP POLICY IF EXISTS "Users can manage their own quran_hifdh_records" ON public.quran_hifdh_records;
CREATE POLICY "Users can manage their own quran_hifdh_records"
ON public.quran_hifdh_records
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Create RLS Policies for quran_khatmah_plans
DROP POLICY IF EXISTS "Users can manage their own quran_khatmah_plans" ON public.quran_khatmah_plans;
CREATE POLICY "Users can manage their own quran_khatmah_plans"
ON public.quran_khatmah_plans
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_quran_hifdh_user_review ON public.quran_hifdh_records(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_quran_hifdh_surah ON public.quran_hifdh_records(user_id, surah_number);
CREATE INDEX IF NOT EXISTS idx_quran_khatmah_user ON public.quran_khatmah_plans(user_id);
